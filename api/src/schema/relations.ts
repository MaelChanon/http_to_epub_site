import { defineRelations } from "drizzle-orm";
import * as mangas from "./mangas.js";
import * as users from "./users.js";

const schema = { ...users, ...mangas };

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
}));
