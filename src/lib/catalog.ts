/**
 * Zex Box Catalog
 *
 * Curated static catalog of popular movies & TV shows with real TMDB poster paths.
 * TMDB image CDN (image.tmdb.org) does not require an API key — once you know
 * the poster_path, the URL works directly.
 *
 * Each item includes a TMDB ID so playback can use multiembed.mov embeds.
 */

export interface Title {
  id: number; // TMDB ID
  type: "movie" | "tv";
  title: string;
  year: number;
  rating: number; // 0-10
  runtime?: number; // minutes (movies) or episode runtime (tv)
  genres: string[];
  overview: string;
  poster: string; // full URL
  backdrop?: string;
  logo?: string;
  seasons?: number; // for TV
  episodes?: number; // for TV
  cast?: string[];
  director?: string;
  featured?: boolean; // for hero carousel
}

const IMG = (path: string, size = "w500") => `https://image.tmdb.org/t/p/${size}${path}`;
const BACKDROP = (path: string) => `https://image.tmdb.org/t/p/original${path}`;

export const CATALOG: Title[] = [
  // ===== FEATURED (Hero carousel) =====
  {
    id: 299536,
    type: "movie",
    title: "Avengers: Infinity War",
    year: 2018,
    rating: 8.3,
    runtime: 149,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "As the Avengers and their allies have continued to protect the world from threats too large for any one hero, a new danger has emerged from the cosmic shadows: Thanos. A despot of intergalactic infamy, his goal is to collect all six Infinity Stones, artifacts of unimaginable power, and use them to inflict his twisted will on all of reality. Everything the Avengers have fought for has led up to this moment, the fate of Earth and existence itself has never been more uncertain.",
    poster: IMG("/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg"),
    backdrop: BACKDROP("/lmZFxXgJE3vgrciwuDib0N8CfQo.jpg"),
    director: "Anthony Russo, Joe Russo",
    cast: ["Robert Downey Jr.", "Chris Hemsworth", "Mark Ruffalo", "Chris Evans", "Scarlett Johansson"],
    featured: true,
  },
  {
    id: 299534,
    type: "movie",
    title: "Avengers: Endgame",
    year: 2019,
    rating: 8.4,
    runtime: 181,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "After the devastating events of Avengers: Infinity War, the universe is in ruins due to the efforts of the Mad Titan, Thanos. With the help of remaining allies, the Avengers must assemble once more in order to undo Thanos' actions and restore order to the universe once and for all, no matter what consequences may be in store.",
    poster: IMG("/or06FN3Dka5tukK1e9sl16pB3iy.jpg"),
    backdrop: BACKDROP("/7RyHsO4yDXtBv1zUU3mTpIrQjyh.jpg"),
    director: "Anthony Russo, Joe Russo",
    cast: ["Robert Downey Jr.", "Chris Evans", "Mark Ruffalo", "Chris Hemsworth", "Scarlett Johansson"],
    featured: true,
  },
  {
    id: 76600,
    type: "movie",
    title: "Avatar: The Way of Water",
    year: 2022,
    rating: 7.6,
    runtime: 192,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "Set more than a decade after the events of the first film, learn the story of the Sully family, the trouble that follows them, the lengths they go to keep each other safe, the battles they fight to stay alive, and the tragedies they endure.",
    poster: IMG("/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg"),
    backdrop: BACKDROP("/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg"),
    director: "James Cameron",
    cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver", "Stephen Lang", "Kate Winslet"],
    featured: true,
  },
  {
    id: 597,
    type: "movie",
    title: "Titanic",
    year: 1997,
    rating: 7.9,
    runtime: 194,
    genres: ["Drama", "Romance"],
    overview:
      "Eighty-four years later, a 101-year-old woman named Rose DeWitt Bukater tells the story to her granddaughter Lizzy Calvert, Brock Lovett, Lewis Bodine, Bobby Buell and Anatoly Mikailavich on the Keldysh about her life set in April 10th 1912, on a ship called Titanic when young Rose boards the departing ship with the upper-class passengers and her mother, Ruth DeWitt Bukater, and her fiancé, Caledon Hockley.",
    poster: IMG("/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg"),
    backdrop: BACKDROP("/yDI6D5ZQh67YUanr55d0ZhdwHJW.jpg"),
    director: "James Cameron",
    cast: ["Leonardo DiCaprio", "Kate Winslet", "Billy Zane", "Kathy Bates"],
    featured: true,
  },

  // ===== TRENDING MOVIES =====
  {
    id: 569094,
    type: "movie",
    title: "Spider-Man: Across the Spider-Verse",
    year: 2023,
    rating: 8.4,
    runtime: 140,
    genres: ["Animation", "Action", "Adventure"],
    overview:
      "After reuniting with Gwen Stacy, Miles Morales — Brooklyn's full-time, friendly neighborhood Spider-Man — is catapulted across the Multiverse where he encounters a team of Spider-People charged with protecting its very existence.",
    poster: IMG("/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg"),
    backdrop: BACKDROP("/4HodYYKEIsGOdinkGi2Ucfx4zeM.jpg"),
    director: "Joaquim Dos Santos",
    cast: ["Shameik Moore", "Hailee Steinfeld", "Oscar Isaac", "Jake Johnson"],
  },
  {
    id: 872585,
    type: "movie",
    title: "Oppenheimer",
    year: 2023,
    rating: 8.1,
    runtime: 181,
    genres: ["Drama", "History", "Thriller"],
    overview:
      "The story of J. Robert Oppenheimer's role in the development of the atomic bomb during World War II.",
    poster: IMG("/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg"),
    backdrop: BACKDROP("/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg"),
    director: "Christopher Nolan",
    cast: ["Cillian Murphy", "Emily Blunt", "Matt Damon", "Robert Downey Jr.", "Florence Pugh"],
  },
  {
    id: 346698,
    type: "movie",
    title: "Barbie",
    year: 2023,
    rating: 7.2,
    runtime: 114,
    genres: ["Comedy", "Adventure"],
    overview:
      "Barbie suffers a crisis that leads her to question her world and her existence.",
    poster: IMG("/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg"),
    backdrop: BACKDROP("/ctMserH8g2SeOAnCw5gFjdQF8mo.jpg"),
    director: "Greta Gerwig",
    cast: ["Margot Robbie", "Ryan Gosling", "America Ferrera", "Kate McKinnon"],
  },
  {
    id: 502356,
    type: "movie",
    title: "The Super Mario Bros. Movie",
    year: 2023,
    rating: 7.7,
    runtime: 92,
    genres: ["Animation", "Family", "Adventure", "Fantasy"],
    overview:
      "While working underground to fix a water main, Brooklyn plumbers—and brothers—Mario and Luigi are transported down a mysterious pipe and wander into a magical new world.",
    poster: IMG("/qNBAXBIQlnOThrVvA6mA2B5ggV6.jpg"),
    backdrop: BACKDROP("/nLBRD7UPR6GjmWQp6ASAfCToWKH.jpg"),
    director: "Aaron Horvath",
    cast: ["Chris Pratt", "Anya Taylor-Joy", "Charlie Day", "Jack Black"],
  },
  {
    id: 76341,
    type: "movie",
    title: "Mad Max: Fury Road",
    year: 2015,
    rating: 7.6,
    runtime: 120,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "An apocalyptic story set in the furthest reaches of our planet, in a stark desert landscape where humanity is broken, and most everyone is crazed fighting for the necessities of life.",
    poster: IMG("/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg"),
    backdrop: BACKDROP("/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg"),
    director: "George Miller",
    cast: ["Tom Hardy", "Charlize Theron", "Nicholas Hoult"],
  },
  {
    id: 603,
    type: "movie",
    title: "The Matrix",
    year: 1999,
    rating: 8.2,
    runtime: 136,
    genres: ["Action", "Sci-Fi"],
    overview:
      "Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth.",
    poster: IMG("/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"),
    backdrop: BACKDROP("/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg"),
    director: "The Wachowskis",
    cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss", "Hugo Weaving"],
  },
  {
    id: 155,
    type: "movie",
    title: "The Dark Knight",
    year: 2008,
    rating: 8.5,
    runtime: 152,
    genres: ["Action", "Crime", "Drama", "Thriller"],
    overview:
      "Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.",
    poster: IMG("/qJ2tW6WMUDux911r6m7haRef0WH.jpg"),
    backdrop: BACKDROP("/hqkIcbrOHL86UncnHIsHVcVmzue.jpg"),
    director: "Christopher Nolan",
    cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart", "Maggie Gyllenhaal"],
  },
  {
    id: 27205,
    type: "movie",
    title: "Inception",
    year: 2010,
    rating: 8.4,
    runtime: 148,
    genres: ["Action", "Sci-Fi", "Thriller"],
    overview:
      "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO.",
    poster: IMG("/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg"),
    backdrop: BACKDROP("/s3TBrRGB1iav7gFOCNx3H31MoES.jpg"),
    director: "Christopher Nolan",
    cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page", "Tom Hardy"],
  },
  {
    id: 157433,
    type: "movie",
    title: "Pet Sematary",
    year: 2019,
    rating: 5.7,
    runtime: 101,
    genres: ["Horror", "Thriller"],
    overview:
      "Dr. Louis Creed and his wife, Rachel, relocate from Boston to rural Maine with their two young children. The couple soon discovers a mysterious burial ground hidden deep in the woods near their new home.",
    poster: IMG("/7sq7eka6p5GqLBHUuQjMjj6UkVd.jpg"),
    backdrop: BACKDROP("/jXJxMcVoEuXzym3vFnjqDW4ifo6.jpg"),
    director: "Kevin Kölsch",
    cast: ["Jason Clarke", "Amy Seimetz", "John Lithgow"],
  },
  {
    id: 458156,
    type: "movie",
    title: "John Wick: Chapter 3 – Parabellum",
    year: 2019,
    rating: 7.4,
    runtime: 130,
    genres: ["Action", "Thriller"],
    overview:
      "Super-assassin John Wick returns with a $14 million price tag on his head and an army of bounty-hunting killers on his trail.",
    poster: IMG("/ziuLux6gi9sd3J41mzJAYQXBOOF.jpg"),
    backdrop: BACKDROP("/v0AgdX0s0jV5LSOj5QgobgWvPnC.jpg"),
    director: "Chad Stahelski",
    cast: ["Keanu Reeves", "Halle Berry", "Ian McShane", "Laurence Fishburne"],
  },
  {
    id: 680,
    type: "movie",
    title: "Pulp Fiction",
    year: 1994,
    rating: 8.5,
    runtime: 154,
    genres: ["Crime", "Drama"],
    overview:
      "A burger-loving hit man, his philosophical partner, a drug-addled gangster's moll and a washed-up boxer converge in this sprawling, comedic crime caper.",
    poster: IMG("/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg"),
    backdrop: BACKDROP("/suaEOtk1N1sgg2MTM7oTo74XJTm.jpg"),
    director: "Quentin Tarantino",
    cast: ["John Travolta", "Uma Thurman", "Samuel L. Jackson", "Bruce Willis"],
  },
  {
    id: 550,
    type: "movie",
    title: "Fight Club",
    year: 1999,
    rating: 8.4,
    runtime: 139,
    genres: ["Drama"],
    overview:
      "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy. Their concept catches on, with underground 'fight clubs' forming in every town.",
    poster: IMG("/a26cQPRhJPX6GbWfQbvZdrrp9j9.jpg"),
    backdrop: BACKDROP("/52AfXWuXCHn3UjD17rBruA9MP5l.jpg"),
    director: "David Fincher",
    cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
  },
  {
    id: 13,
    type: "movie",
    title: "Forrest Gump",
    year: 1994,
    rating: 8.5,
    runtime: 142,
    genres: ["Comedy", "Drama", "Romance"],
    overview:
      "A man with a low IQ has accomplished great things in his life and been present during significant historic events—in each case, far exceeding what anyone imagined he could do.",
    poster: IMG("/arw2vcBveWOVZr6pxd9XTd1TdQb.jpg"),
    backdrop: BACKDROP("/3h1JZGDhZ8nzxdgvkxha0qBqi05.jpg"),
    director: "Robert Zemeckis",
    cast: ["Tom Hanks", "Robin Wright", "Gary Sinise"],
  },
  {
    id: 278,
    type: "movie",
    title: "The Shawshank Redemption",
    year: 1994,
    rating: 8.7,
    runtime: 142,
    genres: ["Drama", "Crime"],
    overview:
      "Framed in the 1940s for the double murder of his wife and her lover, upstanding banker Andy Dufresne begins a new life at the Shawshank prison, where he puts his accounting skills to work for an amoral warden.",
    poster: IMG("/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg"),
    backdrop: BACKDROP("/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg"),
    director: "Frank Darabont",
    cast: ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
  },
  {
    id: 238,
    type: "movie",
    title: "The Godfather",
    year: 1972,
    rating: 8.7,
    runtime: 175,
    genres: ["Drama", "Crime"],
    overview:
      "Spanning the years 1945 to 1955, a chronicle of the fictional Italian-American Corleone crime family.",
    poster: IMG("/3bhkrj58Vtu7enYsRolD1fZdja1.jpg"),
    backdrop: BACKDROP("/tmU7GeKVybMWFButWEGl2M4GeiP.jpg"),
    director: "Francis Ford Coppola",
    cast: ["Marlon Brando", "Al Pacino", "James Caan"],
  },
  {
    id: 637,
    type: "movie",
    title: "Life Is Beautiful",
    year: 1997,
    rating: 8.6,
    runtime: 116,
    genres: ["Comedy", "Drama"],
    overview:
      "A touching story of an Italian book seller of Jewish ancestry who lives in his own little fairy world.",
    poster: IMG("/74hLDKjD5aGYOotO6esUVaeISa2.jpg"),
    backdrop: BACKDROP("/bORe0eI72D874TMawOOFvqWS6Xe.jpg"),
    director: "Roberto Benigni",
    cast: ["Roberto Benigni", "Nicoletta Braschi", "Giorgio Cantarini"],
  },

  // ===== TRENDING TV =====
  {
    id: 1399,
    type: "tv",
    title: "Game of Thrones",
    year: 2011,
    rating: 8.5,
    runtime: 60,
    genres: ["Drama", "Adventure", "Fantasy"],
    overview:
      "Seven noble families fight for control of the mythical land of Westeros. Friction between the houses leads to full-scale war.",
    poster: IMG("/1XS1oqL89opfnbLl8WnZY5O1tJv.jpg"),
    backdrop: BACKDROP("/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg"),
    seasons: 8,
    episodes: 73,
    cast: ["Emilia Clarke", "Kit Harington", "Peter Dinklage", "Lena Headey"],
    featured: true,
  },
  {
    id: 1396,
    type: "tv",
    title: "Breaking Bad",
    year: 2008,
    rating: 8.9,
    runtime: 49,
    genres: ["Drama", "Crime", "Thriller"],
    overview:
      "When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live, he becomes filled with a sense of fearlessness and an unrelenting desire to secure his family's financial future at any cost.",
    poster: IMG("/ggFHVNu6YYI5L9vCcjYpyso0V2R.jpg"),
    backdrop: BACKDROP("/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg"),
    seasons: 5,
    episodes: 62,
    cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn", "Dean Norris"],
    featured: true,
  },
  {
    id: 66732,
    type: "tv",
    title: "Stranger Things",
    year: 2016,
    rating: 8.6,
    runtime: 50,
    genres: ["Drama", "Fantasy", "Horror"],
    overview:
      "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
    poster: IMG("/49WJfeN0moxb9IPfGn8AIqMGskD.jpg"),
    backdrop: BACKDROP("/56v2KjBlU4XaOv9rVYEQypROD7P.jpg"),
    seasons: 4,
    episodes: 42,
    cast: ["Millie Bobby Brown", "Finn Wolfhard", "Winona Ryder", "David Harbour"],
  },
  {
    id: 71712,
    type: "tv",
    title: "The Good Doctor",
    year: 2017,
    rating: 8.0,
    runtime: 43,
    genres: ["Drama"],
    overview:
      "A young surgeon with Savant syndrome is recruited into the surgical unit of a prestigious hospital.",
    poster: IMG("/53XBvBE8aTuptUgkmAfPi1NIuRq.jpg"),
    backdrop: BACKDROP("/iLMV2hWQ3zI6gjY1Q8WaR5K2gfK.jpg"),
    seasons: 6,
    episodes: 105,
    cast: ["Freddie Highmore", "Antonia Thomas", "Hill Harper"],
  },
  {
    id: 94605,
    type: "tv",
    title: "Arcane",
    year: 2021,
    rating: 8.7,
    runtime: 41,
    genres: ["Animation", "Action", "Adventure"],
    overview:
      "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war between magic technologies and clashing convictions.",
    poster: IMG("/abf8tHznhSvl9BAElD2cQeRr7do.jpg"),
    backdrop: BACKDROP("/q8eejQcg1bAqImEV8jh8RtBD4uH.jpg"),
    seasons: 2,
    episodes: 18,
    cast: ["Hailee Steinfeld", "Ella Purnell", "Kevin Alejandro"],
  },
  {
    id: 76479,
    type: "tv",
    title: "The Boys",
    year: 2019,
    rating: 8.4,
    runtime: 60,
    genres: ["Action", "Crime", "Drama"],
    overview:
      "A group of vigilantes set out to take down corrupt superheroes who abuse their superpowers.",
    poster: IMG("/2zmTngn1tYC1AvfnrFLhxeD82hz.jpg"),
    backdrop: BACKDROP("/mGVrXeIjyecj6TKmwPVpHlscEmw.jpg"),
    seasons: 4,
    episodes: 32,
    cast: ["Karl Urban", "Jack Quaid", "Antony Starr", "Erin Moriarty"],
  },
  {
    id: 71912,
    type: "tv",
    title: "The Witcher",
    year: 2019,
    rating: 8.1,
    runtime: 60,
    genres: ["Action", "Adventure", "Fantasy"],
    overview:
      "Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts.",
    poster: IMG("/cZ0d3rtvXPVvuiX22sP79K3Hmjz.jpg"),
    backdrop: BACKDROP("/7HtvmsLrhFqJlScjsTvNJZdNLOR.jpg"),
    seasons: 3,
    episodes: 24,
    cast: ["Henry Cavill", "Anya Chalotra", "Freya Allan"],
  },
  {
    id: 82856,
    type: "tv",
    title: "The Mandalorian",
    year: 2019,
    rating: 8.5,
    runtime: 40,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "After the fall of the Galactic Empire, lawlessness has spread throughout the galaxy. A lone gunfighter makes his way through the outer reaches, earning his keep as a bounty hunter.",
    poster: IMG("/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg"),
    backdrop: BACKDROP("/9ijMGlJKqcslswWUzTEwScm82Gs.jpg"),
    seasons: 3,
    episodes: 24,
    cast: ["Pedro Pascal", "Carl Weathers", "Giancarlo Esposito"],
  },
  {
    id: 60625,
    type: "tv",
    title: "Peaky Blinders",
    year: 2013,
    rating: 8.5,
    runtime: 60,
    genres: ["Crime", "Drama"],
    overview:
      "A gangster family epic set in 1900s England, centering on a gang who sew razor blades in the peaks of their caps, and their fierce boss Tommy Shelby.",
    poster: IMG("/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg"),
    backdrop: BACKDROP("/y5Z0WesTjvn59jP6yQWHs5ge6S2.jpg"),
    seasons: 6,
    episodes: 36,
    cast: ["Cillian Murphy", "Paul Anderson", "Helen McCrory"],
  },
  {
    id: 1398,
    type: "tv",
    title: "The Last of Us",
    year: 2023,
    rating: 8.7,
    runtime: 60,
    genres: ["Drama", "Action", "Adventure"],
    overview:
      "Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie, a 14-year-old girl, out of an oppressive quarantine zone.",
    poster: IMG("/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg"),
    backdrop: BACKDROP("/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg"),
    seasons: 1,
    episodes: 9,
    cast: ["Pedro Pascal", "Bella Ramsey", "Anna Torv"],
  },
  {
    id: 94997,
    type: "tv",
    title: "House of the Dragon",
    year: 2022,
    rating: 8.4,
    runtime: 60,
    genres: ["Drama", "Action", "Adventure"],
    overview:
      "The Targaryen dynasty is at the absolute apex of its power, with more than 15 dragons under their yoke. Most empires crumble from such heights. In the case of the Targaryens, their slow fall begins when King Viserys breaks centuries of tradition.",
    poster: IMG("/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg"),
    backdrop: BACKDROP("/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg"),
    seasons: 2,
    episodes: 18,
    cast: ["Paddy Considine", "Matt Smith", "Emma D'Arcy", "Olivia Cooke"],
  },
  {
    id: 60059,
    type: "tv",
    title: "Better Call Saul",
    year: 2015,
    rating: 8.8,
    runtime: 46,
    genres: ["Drama", "Crime"],
    overview:
      "Six years before Saul Goodman meets Walter White, we meet him when the man who will become Saul Goodman is known as Jimmy McGill, a small-time lawyer scraping by.",
    poster: IMG("/fC2HDm5t0kHl7mTm7jxMR31bbtv.jpg"),
    backdrop: BACKDROP("/fy5MSyzKvtoJP5oR0n5lOIvyEZP.jpg"),
    seasons: 6,
    episodes: 63,
    cast: ["Bob Odenkirk", "Jonathan Banks", "Rhea Seehorn"],
  },
  {
    id: 1668,
    type: "tv",
    title: "Friends",
    year: 1994,
    rating: 8.5,
    runtime: 25,
    genres: ["Comedy", "Drama"],
    overview:
      "The misadventures of a group of friends as they navigate the pitfalls of work, life and love in Manhattan.",
    poster: IMG("/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg"),
    backdrop: BACKDROP("/l0qVZIpXtIo7km9u5Yqh0nKvuRF.jpg"),
    seasons: 10,
    episodes: 236,
    cast: ["Jennifer Aniston", "Courteney Cox", "Lisa Kudrow", "Matt LeBlanc"],
  },
  {
    id: 46298,
    type: "tv",
    title: "Money Heist",
    year: 2017,
    rating: 8.3,
    runtime: 70,
    genres: ["Crime", "Drama", "Mystery"],
    overview:
      "A group of very peculiar robbers assault a factory to kidnap the heir of the most powerful family in Spain.",
    poster: IMG("/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg"),
    backdrop: BACKDROP("/gFZriCkpJYsApPZEF3jhxL4yLzG.jpg"),
    seasons: 5,
    episodes: 41,
    cast: ["Úrsula Corberó", "Álvaro Morte", "Itziar Ituño"],
  },
  {
    id: 1429,
    type: "tv",
    title: "Attack on Titan",
    year: 2013,
    rating: 8.6,
    runtime: 24,
    genres: ["Animation", "Action", "Adventure"],
    overview:
      "Many years ago, humanity was forced to retreat behind the towering walls of a fortified city to escape the massive, man-eating Titans that roamed the land outside their fortress.",
    poster: IMG("/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg"),
    backdrop: BACKDROP("/rqbCbjB19amtOtFQbb3K2lgm2zv.jpg"),
    seasons: 4,
    episodes: 89,
    cast: ["Yuki Kaji", "Yui Ishikawa", "Marina Inoue"],
  },

  // ===== MORE MOVIES =====
  {
    id: 634649,
    type: "movie",
    title: "Spider-Man: No Way Home",
    year: 2021,
    rating: 8.0,
    runtime: 148,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "Peter Parker is unmasked and no longer able to separate his normal life from the high-stakes of being a Super Hero.",
    poster: IMG("/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg"),
    backdrop: BACKDROP("/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg"),
    director: "Jon Watts",
    cast: ["Tom Holland", "Zendaya", "Benedict Cumberbatch"],
  },
  {
    id: 568124,
    type: "movie",
    title: "Avatar",
    year: 2009,
    rating: 7.6,
    runtime: 162,
    genres: ["Action", "Adventure", "Fantasy", "Sci-Fi"],
    overview:
      "In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission.",
    poster: IMG("/jRXYjXNq0Cs2TcJjLkki24MLp7u.jpg"),
    backdrop: BACKDROP("/Yc9q6QuWrMp9nuDm5R8ExNqbEq.jpg"),
    director: "James Cameron",
    cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver"],
  },
  {
    id: 122,
    type: "movie",
    title: "The Lord of the Rings: The Return of the King",
    year: 2003,
    rating: 8.5,
    runtime: 201,
    genres: ["Adventure", "Fantasy", "Action"],
    overview:
      "Aragorn is revealed as the heir to the ancient kings as he, Gandalf and the other members of the broken fellowship struggle to save Gondor.",
    poster: IMG("/rCzpDGLbOoPwLjy3OAm5NUHTr4Z.jpg"),
    backdrop: BACKDROP("/2u7zbn8EudGtk6mY0x2c3vVXBTc.jpg"),
    director: "Peter Jackson",
    cast: ["Elijah Wood", "Viggo Mortensen", "Ian McKellen"],
  },
  {
    id: 671,
    type: "movie",
    title: "Harry Potter and the Philosopher's Stone",
    year: 2001,
    rating: 7.9,
    runtime: 152,
    genres: ["Adventure", "Fantasy"],
    overview:
      "Harry Potter has lived under the stairs at his aunt and uncle's house his whole life. But on his 11th birthday, he learns he's a powerful wizard.",
    poster: IMG("/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg"),
    backdrop: BACKDROP("/hziiv14OpD73u9gAak4XDDfBKa2.jpg"),
    director: "Chris Columbus",
    cast: ["Daniel Radcliffe", "Rupert Grint", "Emma Watson"],
  },
  {
    id: 558,
    type: "movie",
    title: "Spider-Man 2",
    year: 2004,
    rating: 7.3,
    runtime: 127,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "Peter Parker is going through a major identity crisis. Burned out from being Spider-Man, he decides to shelve his superhero alter ego.",
    poster: IMG("/15c9CSwgFL9aP00pX3Mq2KGgPe7.jpg"),
    backdrop: BACKDROP("/utEXl2EDiXBK6f41wCLsvprvMg4.jpg"),
    director: "Sam Raimi",
    cast: ["Tobey Maguire", "Kirsten Dunst", "Alfred Molina"],
  },
  {
    id: 1726,
    type: "movie",
    title: "Iron Man",
    year: 2008,
    rating: 7.6,
    runtime: 126,
    genres: ["Action", "Adventure", "Sci-Fi"],
    overview:
      "After being held captive in an Afghan cave, billionaire engineer Tony Stark creates a unique weaponized suit of armor to fight evil.",
    poster: IMG("/78lPtwv72eTNqFW9COBYd0aZZci.jpg"),
    backdrop: BACKDROP("/ZQixhAzz1Q9JV2nHFLqYffvO0a.jpg"),
    director: "Jon Favreau",
    cast: ["Robert Downey Jr.", "Gwyneth Paltrow", "Jeff Bridges"],
  },
  {
    id: 19995,
    type: "movie",
    title: "Avatar",
    year: 2009,
    rating: 7.6,
    runtime: 162,
    genres: ["Action", "Adventure", "Fantasy", "Sci-Fi"],
    overview:
      "In the 22nd century, a paraplegic Marine is dispatched to the moon Pandora on a unique mission.",
    poster: IMG("/jRXYjXNq0Cs2TcJjLkki24MLp7u.jpg"),
    backdrop: BACKDROP("/Yc9q6QuWrMp9nuDm5R8ExNqbEq.jpg"),
    director: "James Cameron",
    cast: ["Sam Worthington", "Zoe Saldana", "Sigourney Weaver"],
  },
  {
    id: 604,
    type: "movie",
    title: "Interstellar",
    year: 2014,
    rating: 8.4,
    runtime: 169,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    overview:
      "The adventures of a group of explorers who make use of a newly discovered rift in space-time to surpass humanity's limits.",
    poster: IMG("/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"),
    backdrop: BACKDROP("/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg"),
    director: "Christopher Nolan",
    cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
  },
];

// ===== Helpers =====
export const ALL_GENRES = Array.from(
  new Set(CATALOG.flatMap((t) => t.genres))
).sort();

export function getFeatured() {
  return CATALOG.filter((t) => t.featured);
}
export function getTrendingMovies() {
  return CATALOG.filter((t) => t.type === "movie")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 18);
}
export function getTrendingShows() {
  return CATALOG.filter((t) => t.type === "tv")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 18);
}
export function getTopRated() {
  return [...CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);
}
export function getByGenre(genre: string) {
  return CATALOG.filter((t) => t.genres.includes(genre));
}
export function searchCatalog(q: string): Title[] {
  if (!q.trim()) return [];
  const term = q.toLowerCase();
  return CATALOG.filter(
    (t) =>
      t.title.toLowerCase().includes(term) ||
      t.genres.some((g) => g.toLowerCase().includes(term)) ||
      (t.cast || []).some((c) => c.toLowerCase().includes(term)) ||
      (t.director || "").toLowerCase().includes(term)
  );
}
export function getTitle(id: number) {
  return CATALOG.find((t) => t.id === id);
}
