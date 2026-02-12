import { ProductForm } from '../product-form'
import { createProduct } from '../actions'

export default function NewProductPage() {
  return (
    <ProductForm
      action={createProduct}
      submitLabel="등록"
    />
  )
}
