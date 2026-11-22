// Solo en el servidor Node (no en el edge): el reloj de los reclamos automáticos.
import { claimsTick } from "./lib/claims";

const tick = () => claimsTick().catch((e) => console.error("[reclamos] reloj", e));
setTimeout(tick, 60_000);
setInterval(tick, 10 * 60_000);
