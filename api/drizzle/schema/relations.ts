import { defineRelations } from "drizzle-orm";
import * as epub from "./epub.js";
import * as favorites from "./favorites.js";
import * as mangas from "./mangas.js";
import * as providers from "./providers.js";
import * as users from "./users.js";

const schema = { ...users, ...mangas, ...providers, ...favorites, ...epub };

export const relations = defineRelations(schema, (r) => ({
	mangas: {
		staff: r.many.mangaStaff({
			from: r.mangas.id,
			to: r.mangaStaff.mangaId,
		}),
		genres: r.many.mangaGenres({
			from: r.mangas.id,
			to: r.mangaGenres.mangaId,
		}),
		providers: r.many.mangaProviders({
			from: r.mangas.id,
			to: r.mangaProviders.mangaId,
		}),
		chapters: r.many.chapters({
			from: r.mangas.id,
			to: r.chapters.mangaId,
		}),
		favorites: r.many.favorites({
			from: r.mangas.id,
			to: r.favorites.mangaId,
		}),
		epubs: r.many.epubs({
			from: r.mangas.id,
			to: r.epubs.mangaId,
		}),
	},
	mangaStaff: {
		manga: r.one.mangas({
			from: r.mangaStaff.mangaId,
			to: r.mangas.id,
		}),
	},
	mangaGenres: {
		manga: r.one.mangas({
			from: r.mangaGenres.mangaId,
			to: r.mangas.id,
		}),
	},
	providers: {
		mangas: r.many.mangaProviders({
			from: r.providers.id,
			to: r.mangaProviders.providerId,
		}),
		chapters: r.many.chapters({
			from: r.providers.id,
			to: r.chapters.providerId,
		}),
		catalog: r.many.providerMangas({
			from: r.providers.id,
			to: r.providerMangas.providerId,
		}),
		epubs: r.many.epubs({
			from: r.providers.id,
			to: r.epubs.providerId,
		}),
	},
	mangaProviders: {
		manga: r.one.mangas({
			from: r.mangaProviders.mangaId,
			to: r.mangas.id,
			optional: false,
		}),
		provider: r.one.providers({
			from: r.mangaProviders.providerId,
			to: r.providers.id,
			optional: false,
		}),
		chapters: r.many.chapters({
			from: [r.mangaProviders.mangaId, r.mangaProviders.providerId],
			to: [r.chapters.mangaId, r.chapters.providerId],
		}),
		catalogEntry: r.one.providerMangas({
			from: [r.mangaProviders.providerId, r.mangaProviders.tag],
			to: [r.providerMangas.providerId, r.providerMangas.tag],
		}),
	},
	chapters: {
		manga: r.one.mangas({
			from: r.chapters.mangaId,
			to: r.mangas.id,
			optional: false,
		}),
		provider: r.one.providers({
			from: r.chapters.providerId,
			to: r.providers.id,
			optional: false,
		}),
		pages: r.many.pages({
			from: r.chapters.id,
			to: r.pages.chapterId,
		}),
	},
	pages: {
		chapter: r.one.chapters({
			from: r.pages.chapterId,
			to: r.chapters.id,
		}),
	},
	providerMangas: {
		provider: r.one.providers({
			from: r.providerMangas.providerId,
			to: r.providers.id,
		}),
	},
	users: {
		favorites: r.many.favorites({
			from: r.users.id,
			to: r.favorites.userId,
		}),
		permissions: r.many.userPermissions({
			from: r.users.id,
			to: r.userPermissions.userId,
		}),
		epubs: r.many.epubs({
			from: r.users.id,
			to: r.epubs.userId,
		}),
	},
	userPermissions: {
		user: r.one.users({
			from: r.userPermissions.userId,
			to: r.users.id,
			optional: false,
		}),
	},
	favorites: {
		user: r.one.users({
			from: r.favorites.userId,
			to: r.users.id,
			optional: false,
		}),
		manga: r.one.mangas({
			from: r.favorites.mangaId,
			to: r.mangas.id,
			optional: false,
		}),
	},
	epubs: {
		user: r.one.users({
			from: r.epubs.userId,
			to: r.users.id,
			optional: false,
		}),
		manga: r.one.mangas({
			from: r.epubs.mangaId,
			to: r.mangas.id,
			optional: false,
		}),
		provider: r.one.providers({
			from: r.epubs.providerId,
			to: r.providers.id,
			optional: false,
		}),
	},
}));
