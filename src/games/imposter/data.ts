export type ImposterCategory = {
  id: string;
  title: string;
  titleSv: string;
  emoji: string;
  accent: string;
  /** English words; this exact text is what the database stores. */
  prompts: string[];
};

export const IMPOSTER_CATEGORIES: ImposterCategory[] = [
  {
    id: "celebrities",
    title: "Celebrities",
    titleSv: "Kändisar",
    emoji: "🌟",
    accent: "#F59E0B",
    prompts: [
      "Taylor Swift",
      "Cristiano Ronaldo",
      "Beyonce",
      "Zendaya",
      "Drake",
      "Rihanna",
      "Leonardo DiCaprio",
      "Ariana Grande",
      "Dwayne Johnson",
      "Billie Eilish",
      "Kim Kardashian",
      "Tom Holland",
    ],
  },
  {
    id: "football",
    title: "Football Players",
    titleSv: "Fotbollsspelare",
    emoji: "⚽",
    accent: "#22C55E",
    prompts: [
      "Lionel Messi",
      "Kylian Mbappe",
      "Erling Haaland",
      "Jude Bellingham",
      "Vinicius Junior",
      "Kevin De Bruyne",
      "Harry Kane",
      "Mohamed Salah",
      "Lamine Yamal",
      "Bukayo Saka",
      "Pedri",
      "Robert Lewandowski",
    ],
  },
  {
    id: "food",
    title: "Food",
    titleSv: "Mat",
    emoji: "🍕",
    accent: "#F97316",
    prompts: [
      "Pizza",
      "Burger",
      "Sushi",
      "Pasta",
      "Tacos",
      "Ice cream",
      "Pancakes",
      "Ramen",
      "Lasagna",
      "Chocolate cake",
      "French fries",
      "Fried chicken",
    ],
  },
  {
    id: "movies",
    title: "Movies",
    titleSv: "Filmer",
    emoji: "🎬",
    accent: "#A855F7",
    prompts: [
      "Titanic",
      "The Dark Knight",
      "Frozen",
      "Interstellar",
      "Barbie",
      "Avatar",
      "Shrek",
      "Toy Story",
      "The Lion King",
      "Harry Potter",
      "Gladiator",
      "Finding Nemo",
    ],
  },
  {
    id: "countries",
    title: "Countries",
    titleSv: "Länder",
    emoji: "🌍",
    accent: "#38BDF8",
    prompts: [
      "Brazil",
      "Japan",
      "Italy",
      "Spain",
      "Australia",
      "Mexico",
      "France",
      "Norway",
      "Egypt",
      "Argentina",
      "Thailand",
      "Canada",
    ],
  },
];

type WordInfo = {
  /** Swedish name, when it differs from the English word. */
  sv?: string;
  /** Nicer spelling for display (e.g. accents), when it differs. */
  display?: string;
  image?: string;
  /** Wikimedia images need attribution. */
  credit?: "wikipedia";
};

/** Pictures and translations per word. Photos: Wikipedia / Wikimedia Commons; flags: flagcdn.com. */
export const IMPOSTER_WORDS: Record<string, WordInfo> = {
  "Taylor Swift": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png/330px-Taylor_Swift_at_the_2023_MTV_Video_Music_Awards_%283%29.png","credit":"wikipedia"},
  "Cristiano Ronaldo": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Cristiano_Ronaldo_Croatia_v_Portugal_2_July_2026-075_%28cropped%29.jpg/330px-Cristiano_Ronaldo_Croatia_v_Portugal_2_July_2026-075_%28cropped%29.jpg","credit":"wikipedia"},
  "Beyonce": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Beyonc%C3%A9_-_Tottenham_Hotspur_Stadium_-_1st_June_2023_%2810_of_118%29_%2852946364598%29_%28best_crop%29.jpg/330px-Beyonc%C3%A9_-_Tottenham_Hotspur_Stadium_-_1st_June_2023_%2810_of_118%29_%2852946364598%29_%28best_crop%29.jpg","credit":"wikipedia","display":"Beyoncé"},
  "Zendaya": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Zendaya-byPhilipRomano.jpg/330px-Zendaya-byPhilipRomano.jpg","credit":"wikipedia"},
  "Drake": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Drake_at_The_Carter_Effect_2017_%2836818935200%29_%28cropped%29.jpg/330px-Drake_at_The_Carter_Effect_2017_%2836818935200%29_%28cropped%29.jpg","credit":"wikipedia"},
  "Rihanna": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Rihanna_Fenty_2018.png/330px-Rihanna_Fenty_2018.png","credit":"wikipedia"},
  "Leonardo DiCaprio": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/LeoPTABFI191125-28_%28cropped%29.jpg/330px-LeoPTABFI191125-28_%28cropped%29.jpg","credit":"wikipedia"},
  "Ariana Grande": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7c/Ariana_Grande_promoting_Wicked_%282024%29.jpg/330px-Ariana_Grande_promoting_Wicked_%282024%29.jpg","credit":"wikipedia"},
  "Dwayne Johnson": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Dwayne_Johnson-1764_%284x5_cropped_with_moderate_headroom%29.jpg/330px-Dwayne_Johnson-1764_%284x5_cropped_with_moderate_headroom%29.jpg","credit":"wikipedia"},
  "Billie Eilish": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/BillieEilishO2140725-39_-_54665577407_%28cropped%29.jpg/330px-BillieEilishO2140725-39_-_54665577407_%28cropped%29.jpg","credit":"wikipedia"},
  "Kim Kardashian": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Kim_Kardashian_West_2014.jpg/330px-Kim_Kardashian_West_2014.jpg","credit":"wikipedia"},
  "Tom Holland": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/1/18/TomHolland-byPhilipRomano.jpg/330px-TomHolland-byPhilipRomano.jpg","credit":"wikipedia"},
  "Lionel Messi": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c8/Leo_Messi_Argentina_v_Egypt_7_July_2026-1.jpg/330px-Leo_Messi_Argentina_v_Egypt_7_July_2026-1.jpg","credit":"wikipedia"},
  "Kylian Mbappe": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/9/95/Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg/330px-Kylian_Mbappe_France_v_Senegal_16_June_2026-391_%28cropped%29.jpg","credit":"wikipedia","display":"Kylian Mbappé"},
  "Erling Haaland": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg/330px-Erling_Haaland_Morocco_v_Norway_7_June_2026-51.jpg","credit":"wikipedia"},
  "Jude Bellingham": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Jude_Bellingham_England_v_Ghana_23_June_2026-061_%28cropped%29.jpg/330px-Jude_Bellingham_England_v_Ghana_23_June_2026-061_%28cropped%29.jpg","credit":"wikipedia"},
  "Vinicius Junior": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Vin%C3%ADcius_J%C3%BAnior_Brazil_V_Morocco_13_June_2026-207_%28cropped%29.jpg/330px-Vin%C3%ADcius_J%C3%BAnior_Brazil_V_Morocco_13_June_2026-207_%28cropped%29.jpg","credit":"wikipedia","display":"Vinícius Júnior"},
  "Kevin De Bruyne": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Kevin_De_Bruyne_USMNT_v_Belgium_Mar_28_2026-64_%28cropped%29.jpg/330px-Kevin_De_Bruyne_USMNT_v_Belgium_Mar_28_2026-64_%28cropped%29.jpg","credit":"wikipedia"},
  "Harry Kane": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Harry_Kane_England_v_Ghana_23_June_2026-219_%28cropped%29.jpg/330px-Harry_Kane_England_v_Ghana_23_June_2026-219_%28cropped%29.jpg","credit":"wikipedia"},
  "Mohamed Salah": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Mohamed_Salah_Argentina_v_Egypt_7_July_2026-163_%28cropped%29.jpg/330px-Mohamed_Salah_Argentina_v_Egypt_7_July_2026-163_%28cropped%29.jpg","credit":"wikipedia"},
  "Lamine Yamal": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/1/13/Lamine_Yamal_France_v_Spain_7.24.26-142.jpg/330px-Lamine_Yamal_France_v_Spain_7.24.26-142.jpg","credit":"wikipedia"},
  "Bukayo Saka": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Bukayo_Saka_England_v_Ghana_23_June_2026-057_%28cropped%29.jpg/330px-Bukayo_Saka_England_v_Ghana_23_June_2026-057_%28cropped%29.jpg","credit":"wikipedia"},
  "Pedri": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1c/Pedri_France_v_Spain_7.24.26-245.jpg/330px-Pedri_France_v_Spain_7.24.26-245.jpg","credit":"wikipedia"},
  "Robert Lewandowski": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/2019147183134_2019-05-27_Fussball_1.FC_Kaiserslautern_vs_FC_Bayern_M%C3%BCnchen_-_Sven_-_1D_X_MK_II_-_0228_-_B70I8527_%28cropped%29.jpg/330px-2019147183134_2019-05-27_Fussball_1.FC_Kaiserslautern_vs_FC_Bayern_M%C3%BCnchen_-_Sven_-_1D_X_MK_II_-_0228_-_B70I8527_%28cropped%29.jpg","credit":"wikipedia"},
  "Pizza": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Pizza-3007395.jpg/330px-Pizza-3007395.jpg","credit":"wikipedia"},
  "Burger": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/RedDot_Burger.jpg/330px-RedDot_Burger.jpg","credit":"wikipedia","sv":"Hamburgare"},
  "Sushi": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Sushi_platter.jpg/330px-Sushi_platter.jpg","credit":"wikipedia"},
  "Pasta": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/%28Pasta%29_by_David_Adam_Kess_%28pic.2%29.jpg/330px-%28Pasta%29_by_David_Adam_Kess_%28pic.2%29.jpg","credit":"wikipedia"},
  "Tacos": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg/330px-001_Tacos_de_carnitas%2C_carne_asada_y_al_pastor.jpg","credit":"wikipedia"},
  "Ice cream": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/Ice_cream_with_whipped_cream%2C_chocolate_syrup%2C_and_a_wafer_%28cropped%29.jpg/330px-Ice_cream_with_whipped_cream%2C_chocolate_syrup%2C_and_a_wafer_%28cropped%29.jpg","credit":"wikipedia","sv":"Glass"},
  "Pancakes": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg/330px-Foodiesfeed.com_pouring-honey-on-pancakes-with-walnuts.jpg","credit":"wikipedia","sv":"Pannkakor"},
  "Ramen": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Shoyu_Ramen%EF%BC%88Tokyo_Ramen%EF%BC%89_-_01.jpg/330px-Shoyu_Ramen%EF%BC%88Tokyo_Ramen%EF%BC%89_-_01.jpg","credit":"wikipedia"},
  "Lasagna": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Lasagna_bolognese.jpg/330px-Lasagna_bolognese.jpg","credit":"wikipedia","sv":"Lasagne"},
  "Chocolate cake": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Chocolate_fudge_cake.jpg/330px-Chocolate_fudge_cake.jpg","credit":"wikipedia","sv":"Chokladkaka"},
  "French fries": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/8/83/French_Fries.JPG/330px-French_Fries.JPG","credit":"wikipedia","sv":"Pommes frites"},
  "Fried chicken": {"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/Fried-Chicken-Set.jpg/330px-Fried-Chicken-Set.jpg","credit":"wikipedia","sv":"Friterad kyckling"},
  "Titanic": {"image":"https://upload.wikimedia.org/wikipedia/en/1/18/Titanic_%281997_film%29_poster.png","credit":"wikipedia"},
  "The Dark Knight": {"image":"https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29.jpg","credit":"wikipedia"},
  "Frozen": {"image":"https://upload.wikimedia.org/wikipedia/en/0/05/Frozen_%282013_film%29_poster.jpg","credit":"wikipedia","sv":"Frost"},
  "Interstellar": {"image":"https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg","credit":"wikipedia"},
  "Barbie": {"image":"https://upload.wikimedia.org/wikipedia/en/0/0b/Barbie_2023_poster.jpg","credit":"wikipedia"},
  "Avatar": {"image":"https://upload.wikimedia.org/wikipedia/en/d/d6/Avatar_%282009_film%29_poster.jpg","credit":"wikipedia"},
  "Shrek": {"image":"https://upload.wikimedia.org/wikipedia/en/7/7b/Shrek_%282001_animated_feature_film%29.jpg","credit":"wikipedia"},
  "Toy Story": {"image":"https://upload.wikimedia.org/wikipedia/en/1/13/Toy_Story.jpg","credit":"wikipedia"},
  "The Lion King": {"image":"https://upload.wikimedia.org/wikipedia/en/3/3d/The_Lion_King_poster.jpg","credit":"wikipedia","sv":"Lejonkungen"},
  "Harry Potter": {"image":"https://thumb.wikimedia.org/wikipedia/en/thumb/7/7a/Harry_Potter_and_the_Philosopher%27s_Stone_banner.jpg/330px-Harry_Potter_and_the_Philosopher%27s_Stone_banner.jpg","credit":"wikipedia"},
  "Gladiator": {"image":"https://upload.wikimedia.org/wikipedia/en/f/fb/Gladiator_%282000_film_poster%29.png","credit":"wikipedia"},
  "Finding Nemo": {"image":"https://upload.wikimedia.org/wikipedia/en/2/29/Finding_Nemo.jpg","credit":"wikipedia","sv":"Hitta Nemo"},
  "Brazil": {"image":"https://flagcdn.com/w320/br.png","sv":"Brasilien"},
  "Japan": {"image":"https://flagcdn.com/w320/jp.png"},
  "Italy": {"image":"https://flagcdn.com/w320/it.png","sv":"Italien"},
  "Spain": {"image":"https://flagcdn.com/w320/es.png","sv":"Spanien"},
  "Australia": {"image":"https://flagcdn.com/w320/au.png","sv":"Australien"},
  "Mexico": {"image":"https://flagcdn.com/w320/mx.png","sv":"Mexiko"},
  "France": {"image":"https://flagcdn.com/w320/fr.png","sv":"Frankrike"},
  "Norway": {"image":"https://flagcdn.com/w320/no.png","sv":"Norge"},
  "Egypt": {"image":"https://flagcdn.com/w320/eg.png","sv":"Egypten"},
  "Argentina": {"image":"https://flagcdn.com/w320/ar.png"},
  "Thailand": {"image":"https://flagcdn.com/w320/th.png"},
  "Canada": {"image":"https://flagcdn.com/w320/ca.png","sv":"Kanada"},
};

export function imposterWordLabel(word: string | null | undefined, language: "en" | "sv") {
  if (!word) return "";
  const info = IMPOSTER_WORDS[word];
  return (language === "sv" ? info?.sv : undefined) ?? info?.display ?? word;
}

export function imposterCategoryLabel(category: ImposterCategory | null | undefined, language: "en" | "sv") {
  if (!category) return "";
  return language === "sv" ? category.titleSv : category.title;
}
