import { Percent } from 'dist'

export default function formatPriceImpact(priceImpact: Percent) {
  return `${priceImpact.multiply(-1).toFixed(2)}%`
}
