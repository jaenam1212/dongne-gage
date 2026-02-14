# Inventory Regression Checklist

이 문서는 ledger 기반 재고 관리 변경 이후, 운영 전후 점검을 위한 최소 시나리오를 정리합니다.

## 1) 상태 전이 매트릭스 확인

- `pending -> confirmed`: 성공
- `pending -> cancelled`: 성공
- `confirmed -> completed`: 성공
- `completed -> cancelled`: 성공 (환불/취소 복원)
- `cancelled -> confirmed`: 재고 여유가 있을 때만 성공
- 그 외 전이: 실패 (`INVALID_TRANSITION`)

## 2) 동시성 확인 (과예약 방지)

1. `products.max_quantity = 5` 인 상품 준비
2. 서로 다른 세션에서 동시에 `quantity=3` 예약 2건 요청
3. 기대 결과:
   - 1건만 성공
   - 다른 1건은 재고 부족(`STOCK_EXCEEDED`)으로 실패

## 3) 취소 후 재활성화 확인

1. `quantity=2` 예약 생성 (`pending`)
2. `cancelled`로 변경
3. 동일 예약을 `confirmed`로 변경
4. 기대 결과:
   - 재고 여유 시 성공
   - 재고 부족 시 실패(`STOCK_EXCEEDED`)

## 4) 1인당 제한 확인

1. `max_quantity_per_customer = 3`
2. 같은 전화번호로 `quantity=2` 예약 후 `cancelled`
3. 다시 `quantity=2` 예약
4. 기대 결과:
   - 취소된 예약은 점유 합계에서 제외
   - 활성 점유 합계 기준으로만 제한 검사

## 5) 운영 점검 SQL

### 상품별 ledger 합계 vs cached reserved_count 비교

```sql
SELECT
  p.id,
  p.title,
  p.max_quantity,
  p.reserved_count AS cached_reserved_count,
  COALESCE(SUM(
    CASE
      WHEN r.status IN ('pending', 'confirmed', 'completed') THEN r.quantity
      ELSE 0
    END
  ), 0) AS ledger_reserved_count
FROM products p
LEFT JOIN reservations r ON r.product_id = p.id
GROUP BY p.id, p.title, p.max_quantity, p.reserved_count
ORDER BY p.created_at DESC;
```

### 캐시 불일치 상품만 조회

```sql
SELECT *
FROM (
  SELECT
    p.id,
    p.title,
    p.reserved_count AS cached_reserved_count,
    COALESCE(SUM(
      CASE
        WHEN r.status IN ('pending', 'confirmed', 'completed') THEN r.quantity
        ELSE 0
      END
    ), 0) AS ledger_reserved_count
  FROM products p
  LEFT JOIN reservations r ON r.product_id = p.id
  GROUP BY p.id, p.title, p.reserved_count
) t
WHERE t.cached_reserved_count <> t.ledger_reserved_count;
```
