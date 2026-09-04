// Vercel Serverless Function: /api/weather?venue={球場名}&date={YYYY-MM-DD}
//
// 指定した球場・日付の天気予報を返す。フロントエンドは /api/schedule で取得済みの
// 「次の試合の開催球場・日付」をそのままこのAPIに渡す想定（このAPI自身は日程を
// 取りに行かない＝二重に外部サイトへアクセスしない）。
//
// ===== データソースについて =====
// npb.jp等のHTMLページをスクレイピングするのではなく、Open-Meteo
// （https://open-meteo.com/）という無料・APIキー不要の気象APIをそのまま呼び出している。
// 安定したJSON形式のAPIなので、他のAPI（schedule.js等の「開発環境からHTMLの実物を
// 確認できないまま作った」スクレイピング系）と違い、レスポンス構造が変わって突然
// 壊れるリスクは低い。球場の緯度経度は既知の住所から手動で設定した近似値（天気予報の
// メッシュ解像度からすると十分な精度）。

import axios from "axios";

// schedule.js の VENUE_FULL_NAMES が返す正式名称をキーにした球場の緯度経度。
const STADIUM_COORDS = {
  "楽天モバイルパーク宮城": { lat: 38.2627, lon: 140.8934 },
  "きたぎんボールパーク（盛岡）": { lat: 39.688, lon: 141.127 },
  "こまちスタジアム": { lat: 39.7217, lon: 140.0858 },
  "ヨーク開成山スタジアム": { lat: 37.3925, lon: 140.3697 },
  "エスコンフィールドHOKKAIDO": { lat: 42.9777, lon: 141.5931 },
  "みずほPayPayドーム福岡": { lat: 33.5951, lon: 130.3622 },
  "ベルーナドーム": { lat: 35.7757, lon: 139.5344 },
  "ZOZOマリンスタジアム": { lat: 35.6067, lon: 140.0357 },
  "京セラドーム大阪": { lat: 34.6686, lon: 135.4744 },
  "東京ドーム": { lat: 35.7056, lon: 139.7519 },
  "阪神甲子園球場": { lat: 34.7216, lon: 135.3613 },
  "バンテリンドームナゴヤ": { lat: 35.1857, lon: 136.9457 },
  "横浜スタジアム": { lat: 35.4437, lon: 139.638 },
  "MAZDA Zoom-Zoom スタジアム広島": { lat: 34.3916, lon: 132.4858 },
  "明治神宮野球場": { lat: 35.6746, lon: 139.7154 },
};

// ドーム球場（天候が観戦体験に影響しない）。UIで「屋内球場」であることを示すために使う。
const INDOOR_VENUES = [
  "東京ドーム", "みずほPayPayドーム福岡", "ベルーナドーム", "京セラドーム大阪",
  "バンテリンドームナゴヤ", "エスコンフィールドHOKKAIDO",
];

const WEATHER_CODE_MAP = {
  0: { label: "快晴", icon: "☀️" },
  1: { label: "晴れ", icon: "🌤️" },
  2: { label: "晴れ時々くもり", icon: "⛅" },
  3: { label: "くもり", icon: "☁️" },
  45: { label: "霧", icon: "🌫️" },
  48: { label: "霧", icon: "🌫️" },
  51: { label: "霧雨", icon: "🌦️" },
  53: { label: "霧雨", icon: "🌦️" },
  55: { label: "霧雨", icon: "🌦️" },
  56: { label: "着氷性の霧雨", icon: "🌧️" },
  57: { label: "着氷性の霧雨", icon: "🌧️" },
  61: { label: "小雨", icon: "🌧️" },
  63: { label: "雨", icon: "🌧️" },
  65: { label: "強い雨", icon: "🌧️" },
  66: { label: "着氷性の雨", icon: "🌧️" },
  67: { label: "着氷性の雨", icon: "🌧️" },
  71: { label: "雪", icon: "🌨️" },
  73: { label: "雪", icon: "🌨️" },
  75: { label: "雪", icon: "🌨️" },
  77: { label: "霧雪", icon: "🌨️" },
  80: { label: "にわか雨", icon: "🌦️" },
  81: { label: "にわか雨", icon: "🌦️" },
  82: { label: "激しいにわか雨", icon: "🌧️" },
  85: { label: "にわか雪", icon: "🌨️" },
  86: { label: "にわか雪", icon: "🌨️" },
  95: { label: "雷雨", icon: "⛈️" },
  96: { label: "雷雨（雹）", icon: "⛈️" },
  99: { label: "雷雨（雹）", icon: "⛈️" },
};
function describeCode(code) {
  return WEATHER_CODE_MAP[code] || { label: "不明", icon: "❔" };
}

function jstToday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function findVenueCoords(venueRaw) {
  const venue = (venueRaw || "").trim();
  if (!venue) return null;
  if (STADIUM_COORDS[venue]) return { name: venue, ...STADIUM_COORDS[venue] };
  // 完全一致しない場合は、部分一致でゆるく探す（表記ゆれ対策）
  const found = Object.keys(STADIUM_COORDS).find((k) => k.indexOf(venue) !== -1 || venue.indexOf(k) !== -1);
  return found ? { name: found, ...STADIUM_COORDS[found] } : null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate");

  const venueParam = (req.query.venue || "").toString();
  const dateParam = (req.query.date || jstToday()).toString();
  const debug = req.query.debug === "1";

  const coords = findVenueCoords(venueParam);
  if (!coords) {
    return res.status(200).json({ success: false, unsupported: true, error: "球場情報が見つかりません: " + venueParam });
  }

  const isIndoor = INDOOR_VENUES.indexOf(coords.name) !== -1;

  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + coords.lat + "&longitude=" + coords.lon +
      "&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m" +
      "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=Asia%2FTokyo&forecast_days=16";

    const r = await axios.get(url, { timeout: 8000 });
    const data = r.data || {};

    const dailyIdx = (data.daily && data.daily.time || []).indexOf(dateParam);
    if (dailyIdx === -1) {
      return res.status(200).json({
        success: false,
        error: "指定日の予報範囲外です（16日先までのみ対応）",
        venue: coords.name,
        isIndoor,
        ...(debug ? { debug: { requestedDate: dateParam, availableDates: (data.daily && data.daily.time) || [] } } : {}),
      });
    }

    const daily = {
      date: dateParam,
      weatherCode: data.daily.weathercode[dailyIdx],
      tempMax: data.daily.temperature_2m_max[dailyIdx],
      tempMin: data.daily.temperature_2m_min[dailyIdx],
      precipProbMax: data.daily.precipitation_probability_max[dailyIdx],
    };
    const desc = describeCode(daily.weatherCode);

    // 試合開始頃の目安として、14時（デーゲーム）・18時（ナイター）の時間帯のピンポイント予報も添える
    const hourlyTimes = (data.hourly && data.hourly.time) || [];
    function hourSnapshot(hh) {
      const targetIso = dateParam + "T" + hh + ":00";
      const idx = hourlyTimes.indexOf(targetIso);
      if (idx === -1) return null;
      const code = data.hourly.weathercode[idx];
      const d = describeCode(code);
      return {
        hour: hh,
        temp: data.hourly.temperature_2m[idx],
        precipProbability: data.hourly.precipitation_probability[idx],
        windSpeed: data.hourly.windspeed_10m[idx],
        weatherCode: code,
        label: d.label,
        icon: d.icon,
      };
    }

    return res.status(200).json({
      success: true,
      venue: coords.name,
      isIndoor,
      daily: { ...daily, label: desc.label, icon: desc.icon },
      dayGame: hourSnapshot("14"),
      nightGame: hourSnapshot("18"),
      updatedAt: jstToday(),
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      venue: coords.name,
      isIndoor,
      error: "天気情報の取得に失敗しました",
      ...(debug ? { debug: { errorMessage: String(err.message || err) } } : {}),
    });
  }
}
