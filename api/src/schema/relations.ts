import { defineRelations } from "drizzle-orm";
import * as mangas from "./mangas.js";
import * as providers from "./providers.js";
import * as users from "./users.js";

const schema = { ...users, ...mangas, ...providers };

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
	},
	mangaProviders: {
		manga: r.one.mangas({
			from: r.mangaProviders.mangaId,
			to: r.mangas.id,
		}),
		provider: r.one.providers({
			from: r.mangaProviders.providerId,
			to: r.providers.id,
		}),
	},
	chapters: {
		manga: r.one.mangas({
			from: r.chapters.mangaId,
			to: r.mangas.id,
		}),
		provider: r.one.providers({
			from: r.chapters.providerId,
			to: r.providers.id,
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
}));
