import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";

export { PluginBridge };

const APEX_HOST = "franzlift.vn";
const WWW_HOST = "www.franzlift.vn";
type FetchHandler = NonNullable<typeof handler.fetch>;

export default {
	...handler,
	fetch(
		request: Parameters<FetchHandler>[0],
		env: Parameters<FetchHandler>[1],
		context: Parameters<FetchHandler>[2],
	) {
		const url = new URL(request.url);

		if (url.hostname === "www.franzlift.vn") {
			url.hostname = "franzlift.vn";
			return Response.redirect(url.href, 308);
		}
		if (url.hostname === "www.franzhanoi.com") {
			url.hostname = "franzhanoi.com";
			return Response.redirect(url.href, 308);
		}

		return handler.fetch!(request, env, context);
	},
	scheduled: createScheduledHandler({
		generalCron: "0 * * * *",
		mediaUsageCron: "30 * * * *",
	}),
};
