const legacyProducts: Record<string, string> = {
	"/youjiasG1/982": "thang-may-kinh-franz-cua-mo-tam-tu-dong",
	"/yijia/984": "thang-may-kinh-franz-cua-mo-2-canh",
	"/sx/1019": "thang-may-xay-franz",
	"/youjiatG2/983": "thang-may-kinh-franz-cua-mo-lua-tu-dong",
};

export function legacyProductSlug(pathname: string): string | undefined {
	return legacyProducts[pathname];
}
