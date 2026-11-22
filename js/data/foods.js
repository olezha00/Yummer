import { I18N, t } from "../i18n.js";

/* ---------- Built-in generic foods (values per 100 g) ----------
   Each row: names in [ru, en, pl, de], then kcal, protein, fat, carbs, serving in grams (optional). */
const ROWS = [
  [["Куриная грудка, сырая", "Chicken breast, raw", "Pierś z kurczaka, surowa", "Hähnchenbrust, roh"], 110, 23, 1.2, 0],
  [["Куриная грудка, гриль", "Chicken breast, grilled", "Pierś z kurczaka, grillowana", "Hähnchenbrust, gegrillt"], 165, 31, 3.6, 0],
  [["Куриное бедро, сырое", "Chicken thigh, raw", "Udko z kurczaka, surowe", "Hähnchenschenkel, roh"], 177, 17.3, 11.8, 0],
  [["Индейка, грудка, сырая", "Turkey breast, raw", "Pierś z indyka, surowa", "Putenbrust, roh"], 104, 22.6, 1.2, 0],
  [["Свиная корейка, сырая", "Pork loin, raw", "Schab wieprzowy, surowy", "Schweinelende, roh"], 143, 21, 6.3, 0],
  [["Говяжий фарш постный 5%", "Lean minced beef 5%", "Mielona wołowina chuda 5%", "Rinderhack mager 5%"], 137, 21, 5, 0],
  [["Говяжий фарш 15%", "Minced beef 15%", "Mielona wołowina 15%", "Rinderhack 15%"], 215, 18.6, 15, 0],
  [["Лосось, сырой", "Salmon, raw", "Łosoś, surowy", "Lachs, roh"], 208, 20, 13, 0],
  [["Треска, сырая", "Cod, raw", "Dorsz, surowy", "Kabeljau, roh"], 82, 18, 0.7, 0],
  [["Тунец в собственном соку", "Tuna in water", "Tuńczyk w sosie własnym", "Thunfisch im eigenen Saft"], 116, 26, 1, 0],
  [["Скумбрия копчёная", "Smoked mackerel", "Makrela wędzona", "Geräucherte Makrele"], 305, 19, 25, 0],
  [["Сельдь в масле", "Herring in oil", "Śledź w oleju", "Hering in Öl"], 262, 15, 22, 1],
  [["Яйцо куриное", "Egg", "Jajko kurze", "Hühnerei"], 143, 12.6, 9.5, 0.7, 60],
  [["Яичный белок", "Egg white", "Białko jaja", "Eiweiß (Eiklar)"], 52, 10.9, 0.2, 0.7],
  [["Ветчина варёная (szynka)", "Cooked ham", "Szynka gotowana", "Kochschinken"], 110, 18, 3.5, 1.5],
  [["Кабанос", "Kabanos sausage", "Kabanos", "Kabanos-Wurst"], 470, 25, 40, 2],
  [["Сосиски (parówki)", "Frankfurters", "Parówki", "Wiener Würstchen"], 250, 12, 22, 2],
  [["Творог полужирный (twaróg)", "Quark, half-fat", "Twaróg półtłusty", "Quark, halbfett"], 133, 18.7, 4.7, 3.7],
  [["Творог обезжиренный", "Quark, fat-free", "Twaróg chudy", "Magerquark"], 99, 19.8, 0.5, 3.5],
  [["Зернёный творог (serek wiejski)", "Cottage cheese", "Serek wiejski", "Hüttenkäse"], 97, 11, 5, 2],
  [["Скир натуральный", "Skyr, plain", "Skyr naturalny", "Skyr natur"], 62, 11, 0, 4],
  [["Греческий йогурт 10%", "Greek yogurt 10%", "Jogurt grecki 10%", "Griechischer Joghurt 10%"], 133, 3.8, 10, 4],
  [["Йогурт натуральный 2%", "Natural yogurt 2%", "Jogurt naturalny 2%", "Naturjoghurt 2%"], 60, 4.3, 2, 6],
  [["Кефир 2%", "Kefir 2%", "Kefir 2%", "Kefir 2%"], 51, 3.4, 2, 4.7],
  [["Молоко 2%", "Milk 2%", "Mleko 2%", "Milch 2%"], 50, 3.4, 2, 4.8],
  [["Молоко 3,2%", "Milk 3.2%", "Mleko 3,2%", "Milch 3,2%"], 61, 3.2, 3.2, 4.7],
  [["Сыр гауда", "Gouda cheese", "Ser gouda", "Gouda"], 356, 25, 27.4, 2.2],
  [["Моцарелла", "Mozzarella", "Mozzarella", "Mozzarella"], 254, 18, 19, 2],
  [["Фета", "Feta", "Feta", "Feta"], 264, 14, 21, 4],
  [["Сливочное масло", "Butter", "Masło", "Butter"], 735, 0.7, 81, 0.7],
  [["Сметана 18% (śmietana)", "Sour cream 18%", "Śmietana 18%", "Saure Sahne 18%"], 186, 2.5, 18, 3.6],
  [["Овсяные хлопья", "Rolled oats", "Płatki owsiane", "Haferflocken"], 379, 13.2, 6.5, 60, 40],
  [["Ржаной хлеб", "Rye bread", "Chleb żytni", "Roggenbrot"], 259, 8.5, 3.3, 48, 35],
  [["Цельнозерновой хлеб", "Wholegrain bread", "Chleb pełnoziarnisty", "Vollkornbrot"], 247, 13, 4.2, 41, 35],
  [["Белый хлеб / булка", "White bread / roll", "Chleb pszenny / bułka", "Weißbrot / Brötchen"], 265, 9, 3.2, 49, 50],
  [["Рис белый, сухой", "White rice, dry", "Ryż biały, suchy", "Weißer Reis, roh"], 360, 7, 0.6, 79],
  [["Рис белый, варёный", "White rice, cooked", "Ryż biały, gotowany", "Weißer Reis, gekocht"], 130, 2.7, 0.3, 28],
  [["Рис бурый, сухой", "Brown rice, dry", "Ryż brązowy, suchy", "Naturreis, roh"], 362, 7.5, 2.7, 76],
  [["Макароны, сухие", "Pasta, dry", "Makaron, suchy", "Nudeln, roh"], 371, 13, 1.5, 75],
  [["Макароны, варёные", "Pasta, cooked", "Makaron, gotowany", "Nudeln, gekocht"], 158, 5.8, 0.9, 31],
  [["Гречка, сухая (kasza gryczana)", "Buckwheat, dry", "Kasza gryczana, sucha", "Buchweizen, roh"], 343, 13, 3.4, 71.5],
  [["Гречка, варёная", "Buckwheat, cooked", "Kasza gryczana, gotowana", "Buchweizen, gekocht"], 92, 3.4, 0.6, 20],
  [["Пшено, сухое (kasza jaglana)", "Millet, dry", "Kasza jaglana, sucha", "Hirse, roh"], 378, 11, 4.2, 73],
  [["Кускус, сухой", "Couscous, dry", "Kuskus, suchy", "Couscous, roh"], 376, 12.8, 0.6, 77],
  [["Картофель отварной", "Potatoes, boiled", "Ziemniaki gotowane", "Kartoffeln, gekocht"], 87, 1.9, 0.1, 20],
  [["Батат запечённый", "Sweet potato, baked", "Batat pieczony", "Süßkartoffel, gebacken"], 90, 2, 0.2, 21],
  [["Вареники с картошкой (pierogi ruskie)", "Pierogi with potato and cheese", "Pierogi ruskie", "Piroggen mit Kartoffel und Quark"], 205, 6, 6, 31],
  [["Блины (naleśniki)", "Crêpes", "Naleśniki", "Pfannkuchen (Crêpes)"], 227, 6.4, 9.7, 28],
  [["Чечевица красная, сухая", "Red lentils, dry", "Soczewica czerwona, sucha", "Rote Linsen, roh"], 358, 24, 2, 60],
  [["Нут консервированный", "Chickpeas, canned", "Ciecierzyca konserwowa", "Kichererbsen, Dose"], 139, 7, 2.6, 22],
  [["Фасоль консервированная", "Beans, canned", "Fasola konserwowa", "Bohnen, Dose"], 115, 7.5, 0.5, 21],
  [["Тофу твёрдый", "Firm tofu", "Tofu twarde", "Tofu, fest"], 144, 15.8, 8.7, 2.8],
  [["Банан", "Banana", "Banan", "Banane"], 89, 1.1, 0.3, 22.8, 120],
  [["Яблоко", "Apple", "Jabłko", "Apfel"], 52, 0.3, 0.2, 13.8, 180],
  [["Груша", "Pear", "Gruszka", "Birne"], 57, 0.4, 0.1, 15],
  [["Апельсин", "Orange", "Pomarańcza", "Orange"], 47, 0.9, 0.1, 11.8, 150],
  [["Клубника", "Strawberries", "Truskawki", "Erdbeeren"], 32, 0.7, 0.3, 7.7],
  [["Черника", "Blueberries", "Borówki", "Heidelbeeren"], 57, 0.7, 0.3, 14.5],
  [["Малина", "Raspberries", "Maliny", "Himbeeren"], 52, 1.2, 0.7, 12],
  [["Виноград", "Grapes", "Winogrona", "Weintrauben"], 69, 0.7, 0.2, 18],
  [["Сливы", "Plums", "Śliwki", "Pflaumen"], 46, 0.7, 0.3, 11.4],
  [["Помидор", "Tomato", "Pomidor", "Tomate"], 18, 0.9, 0.2, 3.9, 120],
  [["Огурец", "Cucumber", "Ogórek", "Gurke"], 15, 0.7, 0.1, 3.6],
  [["Перец болгарский", "Bell pepper", "Papryka", "Paprika"], 31, 1, 0.3, 6],
  [["Морковь", "Carrot", "Marchew", "Karotte"], 41, 0.9, 0.2, 9.6],
  [["Брокколи", "Broccoli", "Brokuł", "Brokkoli"], 34, 2.8, 0.4, 6.6],
  [["Капуста белокочанная", "White cabbage", "Kapusta biała", "Weißkohl"], 25, 1.3, 0.1, 5.8],
  [["Квашеная капуста (kiszona)", "Sauerkraut", "Kapusta kiszona", "Sauerkraut"], 19, 0.9, 0.1, 4.3],
  [["Огурец квашеный (ogórek kiszony)", "Pickled cucumber (brined)", "Ogórek kiszony", "Salzgurke"], 12, 0.6, 0.1, 2.2],
  [["Лук репчатый", "Onion", "Cebula", "Zwiebel"], 40, 1.1, 0.1, 9.3],
  [["Салат листовой / микс", "Lettuce / salad mix", "Sałata / mix sałat", "Blattsalat / Salatmix"], 15, 1.4, 0.2, 2.9],
  [["Шпинат", "Spinach", "Szpinak", "Spinat"], 23, 2.9, 0.4, 3.6],
  [["Свёкла варёная", "Beetroot, cooked", "Burak gotowany", "Rote Bete, gekocht"], 44, 1.7, 0.2, 10],
  [["Шампиньоны (pieczarki)", "Button mushrooms", "Pieczarki", "Champignons"], 22, 3.1, 0.3, 3.3],
  [["Авокадо", "Avocado", "Awokado", "Avocado"], 160, 2, 14.7, 8.5],
  [["Оливковое масло", "Olive oil", "Oliwa z oliwek", "Olivenöl"], 884, 0, 100, 0],
  [["Рапсовое масло", "Rapeseed oil", "Olej rzepakowy", "Rapsöl"], 884, 0, 100, 0],
  [["Арахисовая паста", "Peanut butter", "Masło orzechowe", "Erdnussbutter"], 588, 25, 50, 20],
  [["Миндаль", "Almonds", "Migdały", "Mandeln"], 579, 21, 50, 22],
  [["Грецкие орехи", "Walnuts", "Orzechy włoskie", "Walnüsse"], 654, 15, 65, 14],
  [["Семечки подсолнечника", "Sunflower seeds", "Słonecznik łuskany", "Sonnenblumenkerne"], 584, 21, 51, 20],
  [["Тёмный шоколад 70%", "Dark chocolate 70%", "Czekolada gorzka 70%", "Zartbitterschokolade 70%"], 598, 7.8, 43, 46],
  [["Мёд", "Honey", "Miód", "Honig"], 304, 0.3, 0, 82],
  [["Сахар", "Sugar", "Cukier", "Zucker"], 400, 0, 0, 100],
  [["Хумус", "Hummus", "Hummus", "Hummus"], 166, 7.9, 9.6, 14],
  [["Кетчуп", "Ketchup", "Ketchup", "Ketchup"], 112, 1.3, 0.2, 26],
  [["Майонез", "Mayonnaise", "Majonez", "Mayonnaise"], 680, 1, 75, 0.6],
  [["Апельсиновый сок", "Orange juice", "Sok pomarańczowy", "Orangensaft"], 45, 0.7, 0.2, 10.4],
  [["Пиво 5%", "Beer 5%", "Piwo 5%", "Bier 5%"], 43, 0.5, 0, 3.6],
  [["Кофе с молоком (латте)", "Coffee with milk (latte)", "Kawa z mlekiem (latte)", "Milchkaffee (Latte)"], 54, 3.4, 2.9, 4.6],
];
const NAME_INDEX = { ru: 0, en: 1, pl: 2, de: 3 };

/** Generic foods with names in the current UI language (ids stay the same in every language). */
let cache = { lang: null, list: [] };
export function genericFoods() {
  if (cache.lang !== I18N.lang) {
    const li = NAME_INDEX[I18N.lang] ?? 1;
    cache = { lang: I18N.lang, list: ROWS.map(([names, kcal, protein, fat, carbs, serving], i) =>
      ({ id: "g" + i, name: names[li], kcal, protein, fat, carbs, serving: serving || null, source: "generic" })) };
  }
  return cache.list;
}
export const GENERIC_COUNT = ROWS.length;
export const GENERIC_ROWS = ROWS;

export const MEAL_KEYS = ["breakfast", "lunch", "dinner", "snacks"];
/** [[key, label]] in the current language. */
export const meals = () => MEAL_KEYS.map(k => [k, t("meal." + k)]);
export const DEFAULT_GOALS = { kcal: 2200, protein: 140, fat: 70, carbs: 250 };
export function mealLabel(k) { return MEAL_KEYS.includes(k) ? t("meal." + k) : t("meal.other"); }
