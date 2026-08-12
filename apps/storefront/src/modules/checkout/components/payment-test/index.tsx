import { Badge } from "@modules/common/components/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">Внимание:</span> только для тестирования.
    </Badge>
  )
}

export default PaymentTest
