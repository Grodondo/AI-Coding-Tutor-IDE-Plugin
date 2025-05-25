import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
   index("routes/home.tsx"),
   route("about", "routes/about.tsx"),
   route("auth/login","routes/auth/login.tsx"),
   route("auth/register","routes/auth/register.tsx"),
   route("admin/settings","routes/admin/settings.tsx"),
   route("admin/users","routes/admin/users.tsx"),
   route("chat","routes/chat.tsx"),
   route("profile","routes/profile/index.tsx"),
] satisfies RouteConfig;
