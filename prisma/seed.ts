import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 47都道府県マスターデータ
const PREFECTURES = [
  { code: "01", name: "北海道", nameKana: "ほっかいどう", region: "北海道", displayOrder: 1 },
  { code: "02", name: "青森県", nameKana: "あおもりけん", region: "東北", displayOrder: 2 },
  { code: "03", name: "岩手県", nameKana: "いわてけん", region: "東北", displayOrder: 3 },
  { code: "04", name: "宮城県", nameKana: "みやぎけん", region: "東北", displayOrder: 4 },
  { code: "05", name: "秋田県", nameKana: "あきたけん", region: "東北", displayOrder: 5 },
  { code: "06", name: "山形県", nameKana: "やまがたけん", region: "東北", displayOrder: 6 },
  { code: "07", name: "福島県", nameKana: "ふくしまけん", region: "東北", displayOrder: 7 },
  { code: "08", name: "茨城県", nameKana: "いばらきけん", region: "関東", displayOrder: 8 },
  { code: "09", name: "栃木県", nameKana: "とちぎけん", region: "関東", displayOrder: 9 },
  { code: "10", name: "群馬県", nameKana: "ぐんまけん", region: "関東", displayOrder: 10 },
  { code: "11", name: "埼玉県", nameKana: "さいたまけん", region: "関東", displayOrder: 11 },
  { code: "12", name: "千葉県", nameKana: "ちばけん", region: "関東", displayOrder: 12 },
  { code: "13", name: "東京都", nameKana: "とうきょうと", region: "関東", displayOrder: 13 },
  { code: "14", name: "神奈川県", nameKana: "かながわけん", region: "関東", displayOrder: 14 },
  { code: "15", name: "新潟県", nameKana: "にいがたけん", region: "中部", displayOrder: 15 },
  { code: "16", name: "富山県", nameKana: "とやまけん", region: "中部", displayOrder: 16 },
  { code: "17", name: "石川県", nameKana: "いしかわけん", region: "中部", displayOrder: 17 },
  { code: "18", name: "福井県", nameKana: "ふくいけん", region: "中部", displayOrder: 18 },
  { code: "19", name: "山梨県", nameKana: "やまなしけん", region: "中部", displayOrder: 19 },
  { code: "20", name: "長野県", nameKana: "ながのけん", region: "中部", displayOrder: 20 },
  { code: "21", name: "岐阜県", nameKana: "ぎふけん", region: "中部", displayOrder: 21 },
  { code: "22", name: "静岡県", nameKana: "しずおかけん", region: "中部", displayOrder: 22 },
  { code: "23", name: "愛知県", nameKana: "あいちけん", region: "中部", displayOrder: 23 },
  { code: "24", name: "三重県", nameKana: "みえけん", region: "近畿", displayOrder: 24 },
  { code: "25", name: "滋賀県", nameKana: "しがけん", region: "近畿", displayOrder: 25 },
  { code: "26", name: "京都府", nameKana: "きょうとふ", region: "近畿", displayOrder: 26 },
  { code: "27", name: "大阪府", nameKana: "おおさかふ", region: "近畿", displayOrder: 27 },
  { code: "28", name: "兵庫県", nameKana: "ひょうごけん", region: "近畿", displayOrder: 28 },
  { code: "29", name: "奈良県", nameKana: "ならけん", region: "近畿", displayOrder: 29 },
  { code: "30", name: "和歌山県", nameKana: "わかやまけん", region: "近畿", displayOrder: 30 },
  { code: "31", name: "鳥取県", nameKana: "とっとりけん", region: "中国", displayOrder: 31 },
  { code: "32", name: "島根県", nameKana: "しまねけん", region: "中国", displayOrder: 32 },
  { code: "33", name: "岡山県", nameKana: "おかやまけん", region: "中国", displayOrder: 33 },
  { code: "34", name: "広島県", nameKana: "ひろしまけん", region: "中国", displayOrder: 34 },
  { code: "35", name: "山口県", nameKana: "やまぐちけん", region: "中国", displayOrder: 35 },
  { code: "36", name: "徳島県", nameKana: "とくしまけん", region: "四国", displayOrder: 36 },
  { code: "37", name: "香川県", nameKana: "かがわけん", region: "四国", displayOrder: 37 },
  { code: "38", name: "愛媛県", nameKana: "えひめけん", region: "四国", displayOrder: 38 },
  { code: "39", name: "高知県", nameKana: "こうちけん", region: "四国", displayOrder: 39 },
  { code: "40", name: "福岡県", nameKana: "ふくおかけん", region: "九州", displayOrder: 40 },
  { code: "41", name: "佐賀県", nameKana: "さがけん", region: "九州", displayOrder: 41 },
  { code: "42", name: "長崎県", nameKana: "ながさきけん", region: "九州", displayOrder: 42 },
  { code: "43", name: "熊本県", nameKana: "くまもとけん", region: "九州", displayOrder: 43 },
  { code: "44", name: "大分県", nameKana: "おおいたけん", region: "九州", displayOrder: 44 },
  { code: "45", name: "宮崎県", nameKana: "みやざきけん", region: "九州", displayOrder: 45 },
  { code: "46", name: "鹿児島県", nameKana: "かごしまけん", region: "九州", displayOrder: 46 },
  { code: "47", name: "沖縄県", nameKana: "おきなわけん", region: "九州", displayOrder: 47 },
];

// 震度マスターデータ（DMData.jp API準拠）
const INTENSITY_SCALES = [
  { value: "1", displayName: "震度1以上", shortName: "1", numericValue: 1.0, displayOrder: 1 },
  { value: "2", displayName: "震度2以上", shortName: "2", numericValue: 2.0, displayOrder: 2 },
  { value: "3", displayName: "震度3以上", shortName: "3", numericValue: 3.0, displayOrder: 3 },
  { value: "4", displayName: "震度4以上", shortName: "4", numericValue: 4.0, displayOrder: 4 },
  { value: "5-", displayName: "震度5弱以上", shortName: "5弱", numericValue: 5.0, displayOrder: 5 },
  { value: "5+", displayName: "震度5強以上", shortName: "5強", numericValue: 5.5, displayOrder: 6 },
  { value: "6-", displayName: "震度6弱以上", shortName: "6弱", numericValue: 6.0, displayOrder: 7 },
  { value: "6+", displayName: "震度6強以上", shortName: "6強", numericValue: 6.5, displayOrder: 8 },
  { value: "7", displayName: "震度7", shortName: "7", numericValue: 7.0, displayOrder: 9 },
];

async function main() {
  console.log("🌱 Seeding database...");

  // 都道府県マスターデータ投入
  console.log("📍 Seeding prefectures...");
  for (const pref of PREFECTURES) {
    await prisma.prefecture.upsert({
      where: { code: pref.code },
      update: pref,
      create: pref,
    });
  }
  console.log(`✅ Created/Updated ${PREFECTURES.length} prefectures`);

  // 震度マスターデータ投入
  console.log("📊 Seeding intensity scales...");
  for (const intensity of INTENSITY_SCALES) {
    await prisma.intensityScale.upsert({
      where: { value: intensity.value },
      update: intensity,
      create: intensity,
    });
  }
  console.log(`✅ Created/Updated ${INTENSITY_SCALES.length} intensity scales`);

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
