import { defineCageModule } from "../_mod_authoring";
import urlPolyfillCode from "./url?raw";

export default defineCageModule((ctx) => {
  ctx.vm.evalCode(urlPolyfillCode)
})
