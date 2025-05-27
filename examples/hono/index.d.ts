import { Hono } from 'hono';
import { Env, UserDO } from '../../src/UserDO';
export { UserDO };
type User = {
    id: string;
    email: string;
};
declare const app: Hono<{
    Bindings: Env;
    Variables: {
        user: User;
    };
}, import("hono/types").BlankSchema, "/">;
export default app;
