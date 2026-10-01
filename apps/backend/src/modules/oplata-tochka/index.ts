import { ModuleProvider, Modules } from "@medusajs/framework/utils"

import OplataTochkaService from "./service"

export default ModuleProvider(Modules.PAYMENT, {
  services: [OplataTochkaService],
})
