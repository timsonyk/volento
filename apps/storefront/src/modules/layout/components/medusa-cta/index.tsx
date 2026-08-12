import { Text } from "@modules/common/components/ui"

const MedusaCTA = () => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center">
      Volento © {new Date().getFullYear()}
    </Text>
  )
}

export default MedusaCTA
