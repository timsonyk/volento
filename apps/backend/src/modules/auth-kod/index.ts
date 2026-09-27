import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import { ВходПоКоду } from "./service"

export default ModuleProvider(Modules.AUTH, {
  services: [ВходПоКоду],
})
