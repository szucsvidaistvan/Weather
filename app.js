let currentCity = "Debrecen";

document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if (city) {
        currentCity = city;
        fetchWeatherData(currentCity);
    }
});

document.getElementById("refreshBtn").addEventListener("click", () => {
    fetchWeatherData(currentCity);
});

document.getElementById("cityInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const city = document.getElementById("cityInput").value.trim();
        if (city) {
            currentCity = city;
            fetchWeatherData(currentCity);
        }
    }
});

// Pull to refresh implementation
let touchStartY = 0;
const pullIndicator = document.getElementById("pullRefreshIndicator");

window.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
    }
});

window.addEventListener('touchmove', (e) => {
    if (touchStartY === 0) return;
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;
    if (diff > 70 && window.scrollY === 0) {
        pullIndicator.style.top = "0px";
    }
});

window.addEventListener('touchend', (e) => {
    if (touchStartY === 0) return;
    const touchY = e.changedTouches[0].clientY;
    const diff = touchY - touchStartY;
    if (diff > 70 && window.scrollY === 0) {
        pullIndicator.style.top = "0px";
        setTimeout(() => {
            fetchWeatherData(currentCity);
            pullIndicator.style.top = "-40px";
        }, 800);
    } else {
        pullIndicator.style.top = "-40px";
    }
    touchStartY = 0;
});

async function fetchWeatherData(cityName) {
    const mainCard = document.getElementById("weatherMain");
    const hourlyScroll = document.getElementById("hourlyScroll");
    const dailyScroll = document.getElementById("dailyScroll");
    const heatmapContainer = document.getElementById("heatmapContainer");
    
    mainCard.innerHTML = `<div class="loading">Adatok frissítése...</div>`;
    hourlyScroll.innerHTML = "";
    dailyScroll.innerHTML = "";
    heatmapContainer.innerHTML = "";

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=hu&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            mainCard.innerHTML = `<p style="color: #ef4444;">A megadott város nem található!</p>`;
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];

        // Fetching 16 days forecast + past days if available or extended forecast
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&past_days=10&timezone=auto`);
        const weatherData = await weatherRes.json();

        displayWeather(name, country, weatherData);
    } catch (error) {
        console.error(error);
        mainCard.innerHTML = `<p style="color: #ef4444;">Hiba történt az adatok letöltése közben.</p>`;
    }
}

function getWeatherInfo(code) {
    const map = {
        0: { text: "Tiszta", icon: "☀️" },
        1: { text: "Főként tiszta", icon: "🌤️" },
        2: { text: "Változóan felhős", icon: "⛅" },
        3: { text: "Borult", icon: "☁️" },
        51: { text: "Szitálás", icon: "🌧️" },
        61: { text: "Enyhe eső", icon: "🌧️" },
        63: { text: "Mérsékelt eső", icon: "🌧️" },
        65: { text: "Intenzív eső", icon: "⛈️" },
        71: { text: "Hóesés", icon: "🌨️" },
        95: { text: "Zivatar", icon: "⚡" }
    };
    return map[code] || { text: "Változékony", icon: "⛅" };
}

function getHumanReadableRainText(probability, precipitation, cityName) {
    let dryChance = 100 - probability;
    if (dryChance < 0) dryChance = 0;

    let intensityText = precipitation > 2 ? "kiadósabb, áztató jellegű" : "szitáló, szemerkélő";
    if (precipitation > 5) intensityText = "zivataros, felhőszakadalmas";

    return `<strong>Csapadék területi eloszlás:</strong> A modellek szerint ${cityName} területének <strong>${probability}%</strong>-án várható eső, míg a maradék <strong>${dryChance}%</strong>-on nagy eséllyel száraz marad az idő. Ahol esik, ott ${intensityText} csapadékra kell számítani.`;
}

function displayWeather(cityName, country, data) {
    const mainCard = document.getElementById("weatherMain");
    const hourlyScroll = document.getElementById("hourlyScroll");
    const dailyScroll = document.getElementById("dailyScroll");
    const heatmapContainer = document.getElementById("heatmapContainer");
    
    const current = data.current;
    const currentHourProb = data.hourly.precipitation_probability[0] || 0;
    const currentWeatherInfo = getWeatherInfo(current.weather_code);
    const humanText = getHumanReadableRainText(currentHourProb, current.precipitation, cityName);

    mainCard.innerHTML = `
        <div class="city-title">${cityName} <span style="font-size: 0.9rem; color: #94a3b8;">(${country})</span></div>
        <div class="temp-big">${Math.round(current.temperature_2m)}°C</div>
        <div class="desc-text">${currentWeatherInfo.icon} ${currentWeatherInfo.text} (Pára: ${current.relative_humidity_2m}%)</div>
        <div class="human-box">
            <p>${humanText}</p>
        </div>
    `;

    // 1. Következő 36 óra
    let hourlyHtml = '';
    for (let i = 0; i < 36; i++) {
        if (!data.hourly.time[i]) break;

        const dateObj = new Date(data.hourly.time[i]);
        const timeStr = dateObj.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        const dayLabel = i === 0 ? "Ma" : (dateObj.getHours() === 0 ? dateObj.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) : timeStr);
        const temp = Math.round(data.hourly.temperature_2m[i]);
        const prob = data.hourly.precipitation_probability[i];
        const info = getWeatherInfo(data.hourly.weather_code[i]);

        hourlyHtml += `
            <div class="forecast-card">
                <div class="card-time">${dayLabel}<br><span style="font-size:0.8rem">${dateObj.getHours() === 0 ? timeStr : ''}</span></div>
                <div class="card-icon">${info.icon}</div>
                <div class="card-temp">${temp}°C</div>
                <div class="card-rain">💧 ${prob}%</div>
            </div>
        `;
    }
    hourlyScroll.innerHTML = hourlyHtml;

    // 2. Napi / Hosszútávú
    let dailyHtml = '';
    const daily = data.daily;
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr);
        const isToday = dateStr === todayStr;
        const dayName = isToday ? "Ma" : dateObj.toLocaleDateString('hu-HU', { weekday: 'short', month: 'short', day: 'numeric' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const dayInfo = getWeatherInfo(daily.weather_code[i]);
        const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;

        dailyHtml += `
            <div class="forecast-card" style="min-width: 95px; ${isToday ? 'border: 2px solid #38bdf8;' : ''}">
                <div class="card-time">${dayName}</div>
                <div class="card-icon">${dayInfo.icon}</div>
                <div style="font-size: 0.85rem; margin: 4px 0;">
                    <span class="temp-max">▲ ${maxTemp}°C</span><br>
                    <span class="temp-min">▼ ${minTemp}°C</span>
                </div>
                <div class="card-rain">💧 ${rainProb}%</div>
            </div>
        `;
    }
    dailyScroll.innerHTML = dailyHtml;

    // 3. Havi Hőtérkép (Napi bontásban kb. 15-20 nap múlt/jövő ablakban)
    let heatmapHtml = '';
    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const dateObj = new Date(dateStr);
        const isToday = dateStr === todayStr;
        const dayNum = dateObj.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const info = getWeatherInfo(daily.weather_code[i]);

        heatmapHtml += `
            <div class="heatmap-cell ${isToday ? 'today' : ''}" title="${dayNum}: ${maxTemp}°C">
                <div class="heatmap-date">${dayNum}</div>
                <div style="font-size: 1.1rem; margin: 2px 0;">${info.icon}</div>
                <div class="heatmap-temp">${maxTemp}°C</div>
            </div>
        `;
    }
    heatmapContainer.innerHTML = heatmapHtml;
}

fetchWeatherData(currentCity);
