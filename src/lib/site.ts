import { getEmDashCollection, getEmDashEntry } from "emdash";

export type SiteContent = Record<string, any>;
export type Byline = {
	id: string;
	slug: string;
	displayName: string;
	bio?: string;
	avatarUrl?: string;
};

export type Product = {
	id: string;
	slug: string;
	name: string;
	summary: string;
	body: string;
	content?: any;
	contentMode?: string;
	image: string;
	gallery: string[];
	legacyPath?: string;
	sortOrder: number;
	dataId?: string;
	byline?: Byline | null;
};
export type Post = {
	id: string;
	slug: string;
	title: string;
	excerpt: string;
	body: string;
	content?: any;
	image: string;
	date: string;
	sortOrder: number;
	dataId?: string;
	byline?: Byline | null;
};
export type SiteModel = {
	content: SiteContent;
	products: Product[];
	posts: Post[];
};

const entryQuery = getEmDashEntry as (
	collection: string,
	slug: string,
) => Promise<any>;
const collectionQuery = getEmDashCollection as (
	collection: string,
	options?: any,
) => Promise<any>;

function setCache(Astro: any, hint: any) {
	if (hint && Astro.cache?.set) Astro.cache.set(hint);
}

function resolveImage(img: any): string {
	if (!img) return "";
	if (typeof img === "string") return img;
	if (img.url || img.src || img.previewUrl) {
		return img.url || img.src || img.previewUrl;
	}
	const storageKey = img.meta?.storageKey;
	if (img.provider === "local" && storageKey) {
		return `/_emdash/api/media/file/${encodeURIComponent(storageKey)}`;
	}
	return "";
}

function resolveGallery(entryData: any): string[] {
	if (Array.isArray(entryData.gallery_v2) && entryData.gallery_v2.length > 0) {
		const resolved = entryData.gallery_v2
			.map((item: any) =>
				typeof item === "string" ? item : resolveImage(item?.image),
			)
			.filter(Boolean);
		if (resolved.length > 0) return resolved;
	}
	if (Array.isArray(entryData.gallery) && entryData.gallery.length > 0) {
		return entryData.gallery
			.map((item: any) => {
				if (typeof item === "string") return item;
				return resolveImage(item?.image || item);
			})
			.filter(Boolean);
	}
	return [];
}

export async function getSiteModel(Astro: any): Promise<SiteModel> {
	const [
		siteResult,
		productResult,
		postResult,
		projectsResult,
		servicesResult,
		techResult,
		vrResult,
		heroResult,
		reasonsResult,
		statsResult,
		testimonialsResult,
	] = await Promise.all([
		entryQuery("site_data", "config"),
		collectionQuery("products", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("posts", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("projects", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("services", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("tech_items", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("vr_cabins", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("hero_slides", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("reasons", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("stats", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}),
		collectionQuery("testimonials", {
			status: "published",
			limit: 100,
			orderBy: { sort_order: "asc" },
		}).catch(() => ({ entries: [] })),
	]);

	[
		siteResult,
		productResult,
		postResult,
		projectsResult,
		servicesResult,
		techResult,
		vrResult,
		heroResult,
		reasonsResult,
		statsResult,
		testimonialsResult,
	].forEach((r) => setCache(Astro, r?.cacheHint));

	const content = {
		...((siteResult.entry?.data?.content || {}) as SiteContent),
	};

	// Map dedicated site_data columns onto the content model with fallback
	const sd = siteResult.entry?.data || {};
	if (sd.site_name) content["branding.siteName"] = sd.site_name;
	if (sd.logo) content["branding.logo"] = resolveImage(sd.logo);
	if (sd.logo_light) content["branding.logoLight"] = resolveImage(sd.logo_light);
	if (sd.hotline) content["contact.hotline"] = sd.hotline;
	if (sd.sales_phone) content["contact.salesPhone"] = sd.sales_phone;
	if (sd.tech_phone) content["contact.techPhone"] = sd.tech_phone;
	if (sd.email) content["contact.email"] = sd.email;
	if (sd.address) content["contact.address"] = sd.address;
	if (sd.zalo_url) content["contact.zalo"] = sd.zalo_url;
	if (sd.facebook_url) content["contact.facebook"] = sd.facebook_url;
	if (sd.facebook_name) content["contact.facebookName"] = sd.facebook_name;
	if (sd.facebook_avatar) content["contact.facebookAvatar"] = resolveImage(sd.facebook_avatar);
	if (sd.facebook_cover) content["contact.facebookCover"] = resolveImage(sd.facebook_cover);
	if (sd.about_title) content["about.title"] = sd.about_title;
	if (sd.about_intro) content["about.p1"] = sd.about_intro;
	if (sd.about_story) content["about.story1"] = sd.about_story;
	if (sd.about_vision) content["about.vision"] = sd.about_vision;
	if (sd.about_mission) content["about.mission"] = sd.about_mission;
	if (sd.about_video) content["home.aboutVideo"] = sd.about_video;
	if (sd.vr_url) content["vr.url"] = sd.vr_url;

	if (projectsResult.entries?.length) {
		content.projects = projectsResult.entries.map((e: any) => [
			e.data.title || "",
			e.data.description || "",
			resolveImage(e.data.image) || "",
			resolveGallery(e.data),
			e.data.video_url || "",
		]);
		content.homeCases = content.projects;
	}

	if (servicesResult.entries?.length) {
		content.services = servicesResult.entries.map((e: any) => [
			e.data.title || "",
			e.data.description || "",
		]);
	}

	if (techResult.entries?.length) {
		content.techItems = techResult.entries.map((e: any) => [
			e.data.title || "",
			e.data.description || "",
		]);
	}

	if (vrResult.entries?.length) {
		content.vrCabins = vrResult.entries.map((e: any) => [
			e.data.title || "",
			e.data.description || "",
			resolveImage(e.data.image) || "",
			e.data.vr_url || "",
		]);
	}

	if (heroResult.entries?.length) {
		content.homeHeroSlides = heroResult.entries.map((e: any) => [
			e.data.title || "",
			e.data.message || "",
			resolveImage(e.data.image) || "",
		]);
	}

	if (reasonsResult.entries?.length) {
		content.homeReasons = reasonsResult.entries.map((e: any) => [
			e.data.title || "",
			e.data.description || "",
			resolveImage(e.data.image) || "",
		]);
	}

	if (statsResult.entries?.length) {
		content.homeStats = statsResult.entries.map((e: any) => [
			e.data.value || "",
			e.data.label || "",
		]);
	}

	if (testimonialsResult?.entries?.length) {
		content.testimonials = testimonialsResult.entries.map((e: any) => ({
			name: e.data.name || "",
			address: e.data.address || "",
			content: e.data.content || "",
			image: resolveImage(e.data.image) || "",
			video_url: e.data.video_url || "",
		}));
	} else if (!content.testimonials) {
		content.testimonials = [
			{
				name: "Bác Nguyễn Văn Thành",
				address: "Biệt thự Louis City, Đại Mỗ, Hà Nội",
				content: "Gia đình tôi rất hài lòng khi lựa chọn thang máy Franz. Thiết kế kính sang trọng, hố pit chỉ 60mm nên không phải can thiệp móng nhà cũ. Thang chạy êm ái, an toàn tuyệt đối.",
				image: "/assets-local/02-bce74fae6c8eb1eba141044b0b26d970.png",
			},
			{
				name: "Anh Trần Minh Tuấn",
				address: "Nhà phố cải tạo Phố Huế, Hoàn Kiếm",
				content: "Nhà phố 5 tầng diện tích nhỏ, may mắn chọn được giải pháp thang không phòng máy của Franz. Kích thước giếng thang chỉ 1m2 nhưng cabin thoáng rộng, vận hành ổn định.",
				image: "/assets-local/03-2aeef62d95c474ce21e032cf459b418e.png",
			},
			{
				name: "Chị Lê Thu Hà",
				address: "KĐT Ciputra, Tây Hồ, Hà Nội",
				content: "Tiến độ thi công rất chuẩn xác, các bạn kỹ thuật viên nhiệt tình. Khách đến chơi nhà ai cũng khen thang máy đẹp, hiện đại và rất tôn giá trị ngôi nhà.",
				image: "/assets-local/04-d0c9bfc93f3cfe73f93e1cb285769618.png",
			},
		];
	}

	if (Array.isArray(sd.about_sections) && sd.about_sections.length) {
		content.aboutSections = sd.about_sections.map((sec: any) => ({
			title: sec.title || "",
			content: sec.content || "",
			image: resolveImage(sec.image) || "",
			video_url: sec.video_url || "",
		}));
	}

	const products = (productResult.entries || [])
		.map((entry: any) => ({
			id: entry.id,
			slug: entry.id,
			dataId: entry.data.id,
			name: entry.data.name || "",
			summary: entry.data.summary || "",
			body: entry.data.body_html || "",
			content: entry.data.content || null,
			contentMode: entry.data.content_mode || "portableText",
			image:
				resolveImage(entry.data.featured_image) || entry.data.image_url || "",
			gallery: resolveGallery(entry.data),
			legacyPath: entry.data.legacy_path || undefined,
			sortOrder: Number(entry.data.sort_order || 0),
		}))
		.sort((a: Product, b: Product) => a.sortOrder - b.sortOrder);

	const posts = (postResult.entries || [])
		.map((entry: any) => ({
			id: entry.id,
			slug: entry.id,
			dataId: entry.data.id,
			title: entry.data.title || "",
			excerpt: entry.data.excerpt || "",
			body: entry.data.body_html || "",
			content: entry.data.content || null,
			image:
				resolveImage(entry.data.featured_image) || entry.data.image_url || "",
			date: entry.data.display_date || "",
			sortOrder: Number(entry.data.sort_order || 0),
		}))
		.sort((a: Post, b: Post) => a.sortOrder - b.sortOrder);

	return { content, products, posts };
}

export async function getProductPage(Astro: any, slug: string) {
	const [model, result] = await Promise.all([
		getSiteModel(Astro),
		entryQuery("products", slug),
	]);
	setCache(Astro, result.cacheHint);
	const entry = result.entry;
	if (!entry) return { model, product: null };
	let byline: Byline | null = null;
	if (entry.data.bylines && entry.data.bylines.length > 0) {
		const b = entry.data.bylines[0]?.byline;
		if (b) {
			byline = {
				id: b.id,
				slug: b.slug,
				displayName: b.displayName || b.name || "",
				bio: b.bio || "",
				avatarUrl: b.avatarUrl || "",
			};
		}
	} else if (entry.data.primary_byline_id) {
		try {
			const { getByline } = await import("emdash");
			const b = await getByline(entry.data.primary_byline_id);
			if (b) {
				byline = {
					id: b.id,
					slug: b.slug,
					displayName: b.displayName || "",
					bio: b.bio || "",
					avatarUrl: b.avatarStorageKey
						? `/_emdash/api/media/file/${encodeURIComponent(b.avatarStorageKey)}`
						: "",
				};
			}
		} catch {}
	}

	const product: Product = {
		id: entry.id,
		slug: entry.id,
		dataId: entry.data.id,
		name: entry.data.name || "",
		summary: entry.data.summary || "",
		body: entry.data.body_html || "",
		content: entry.data.content || null,
		contentMode: entry.data.content_mode || "html",
		image:
			resolveImage(entry.data.featured_image) || entry.data.image_url || "",
		gallery: resolveGallery(entry.data),
		legacyPath: entry.data.legacy_path || undefined,
		sortOrder: Number(entry.data.sort_order || 0),
		byline,
	};
	return { model, product };
}

export async function getPostPage(Astro: any, slug: string) {
	const [model, result] = await Promise.all([
		getSiteModel(Astro),
		entryQuery("posts", slug),
	]);
	setCache(Astro, result.cacheHint);
	const entry = result.entry;
	if (!entry) return { model, post: null };
	const post: Post = {
		id: entry.id,
		slug: entry.id,
		dataId: entry.data.id,
		title: entry.data.title || "",
		excerpt: entry.data.excerpt || "",
		body: entry.data.body_html || "",
		content: entry.data.content || null,
		image:
			resolveImage(entry.data.featured_image) || entry.data.image_url || "",
		date: entry.data.display_date || "",
		sortOrder: Number(entry.data.sort_order || 0),
	};
	return { model, post };
}

export const pageUrl = {
	about: "/gioi-thieu",
	products: "/san-pham",
	services: "/dich-vu",
	projects: "/du-an",
	blog: "/tin-tuc",
	tech: "/cong-nghe",
	contact: "/lien-he",
	vr: "/360VR",
};
export const heroImgs = [
	"/assets-local/02-bce74fae6c8eb1eba141044b0b26d970.png",
	"/assets-local/03-2aeef62d95c474ce21e032cf459b418e.png",
	"/assets-local/04-d0c9bfc93f3cfe73f93e1cb285769618.png",
	"/assets-local/05-df2488e7f314f5e3ede37268cf238bb0.png",
];
export const advImgs = [
	"/assets-local/06-8c3cfe6ed48e0d4939b790419bf12d84.png",
	"/assets-local/07-399adc95948b507d47e4fe295d45e492.png",
	"/assets-local/08-b83d8158bc0dfa9fd0a1443de5583b53.png",
	"/assets-local/09-54086bca79dd4a4376e87b9e84913998.png",
];
export const text = (content: SiteContent, key: string, fallback = "") =>
	content[key] || fallback;
export function toYoutubeEmbed(url: any, fallback = "https://www.youtube.com/embed/Y79yUo46ePU"): string {
	if (!url) return fallback;
	let str = String(url).trim();
	if (!str) return fallback;

	const iframeMatch = str.match(/src=["']([^"']+)["']/);
	if (iframeMatch) str = iframeMatch[1].trim();

	const embedMatch = str.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/);
	if (embedMatch) return "https://www.youtube.com/embed/" + embedMatch[1];

	if (!/^https?:\/\//i.test(str)) {
		if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return "https://www.youtube.com/embed/" + str;
		str = "https://" + str;
	}
	try {
		const parsed = new URL(str);
		const host = parsed.hostname.toLowerCase();
		const path = parsed.pathname;
		let id = "";
		if (host.includes("youtu.be")) {
			id = path.split("/").filter(Boolean)[0] || "";
		} else if (host.includes("youtube")) {
			if (path.includes("/shorts/")) {
				id = path.split("/shorts/")[1]?.split("/")[0]?.split("?")[0] || "";
			} else if (path.includes("/embed/")) {
				id = path.split("/embed/")[1]?.split("/")[0]?.split("?")[0] || "";
			} else if (path.includes("/live/")) {
				id = path.split("/live/")[1]?.split("/")[0]?.split("?")[0] || "";
			} else {
				id = parsed.searchParams.get("v") || "";
			}
		}
		id = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
		return id ? "https://www.youtube.com/embed/" + id : fallback;
	} catch {
		return fallback;
	}
}

export function formatPhone(phone: string) {
	const digits = String(phone || "").replace(/\D/g, "");
	return digits.length === 10
		? `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`
		: phone;
}
