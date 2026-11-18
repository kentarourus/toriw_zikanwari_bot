import {readSavedData, saveData} from './offline-data.js';

const endpoint='https://api.open-meteo.com/v1/forecast?latitude=25.0330&longitude=121.5654&daily=weather_code%2Ctemperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max&timezone=Asia%2FTaipei&forecast_days=7';
export function condition(code){if(code===0)return ['☀','晴れ'];if([1,2].includes(code))return ['🌤','晴れ時々曇り'];if(code===3)return ['☁','曇り'];if([45,48].includes(code))return ['🌫','霧'];if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return ['☂','雨'];if([71,73,75,77,85,86].includes(code))return ['❄','雪'];if([95,96,99].includes(code))return ['☈','雷雨'];return ['—','予報なし'];}
export function parseForecast(data){const d=data?.daily;if(!Array.isArray(d?.time)||!d.time.length)throw new Error('invalid weather');return d.time.map((date,i)=>({date,code:d.weather_code?.[i],max:d.temperature_2m_max?.[i],min:d.temperature_2m_min?.[i],rain:d.precipitation_probability_max?.[i]})).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);}

function renderForecast(forecast, root) {
  root.replaceChildren(...forecast.map(day => {
    const card = document.createElement('article');
    card.className = 'weather-day';
    const heading = document.createElement('h3');
    const [year, month, date] = day.date.split('-').map(Number);
    const weekday = ['日','月','火','水','木','金','土'][new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
    heading.textContent = `${month}/${date}（${weekday}）`;
    const [icon, label] = condition(day.code);
    const visual = document.createElement('span');
    visual.className = 'weather-icon';
    visual.setAttribute('aria-hidden', 'true');
    visual.textContent = icon;
    const description = document.createElement('div');
    description.className = 'weather-condition';
    description.textContent = label;
    const temperature = document.createElement('div');
    temperature.className = 'weather-temp';
    temperature.textContent = `${Number.isFinite(day.max) ? Math.round(day.max) + '°' : '—'} / `;
    const low = document.createElement('small');
    low.textContent = Number.isFinite(day.min) ? Math.round(day.min) + '°' : '—';
    temperature.append(low);
    const rain = document.createElement('div');
    rain.className = 'weather-rain';
    rain.textContent = `降水確率 ${Number.isFinite(day.rain) ? Math.round(day.rain) + '%' : '—'}`;
    card.append(heading, visual, description, temperature, rain);
    return card;
  }));
  root.scrollLeft = 0;
}

async function displayWeather() {
  const status = document.getElementById('weather-status');
  const root = document.getElementById('weather-days');
  try {
    if (!navigator.onLine) throw new Error('Offline');
    const response = await fetch(endpoint, {signal: AbortSignal.timeout(12000), cache: 'no-store'});
    if (!response.ok) throw new Error('Forecast unavailable');
    const data = await response.json();
    renderForecast(parseForecast(data), root);
    saveData('weather', {data, savedAt: new Date().toISOString()});
    status.textContent = '';
  } catch {
    const saved = readSavedData('weather');
    try {
      renderForecast(parseForecast(saved?.data), root);
      const stamp = new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(saved.savedAt));
      status.textContent = `保存済みの予報（台湾時間 ${stamp} 取得）`;
    } catch {
      status.textContent = '天気予報を取得できませんでした。通信できるときに再読み込みしてください。';
    }
  }
}

if (typeof document !== 'undefined') displayWeather();
