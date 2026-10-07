let currentCity = "Debrecen";
let globalWeatherData = null;
let heatmapMode = "temp";

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

document.getElementById("heatmapToggleBtn").addEventListener("click", () => {
    heatmapMode = heatmapMode === "temp" ? "rain" : "temp";
    document.getElementById("heatmapToggleBtn").innerText = heatmapMode === "temp" ? "Csapadékra vált" : "Hőmérsékletre vált";
    
    if (heatmapMode === "temp") {
        document.getElementById("legendMinLabel").innerText = "Hideg (Kék)";
        document.getElementById("legendMaxLabel").innerText = "Meleg (Piros)";
        document.getElementById("legendColors").innerHTML = `
            <span class="l-box" style="background: #3b82f6;"></span>
            <span class="l-box" style="background: #93c5fd;"></span>
            <span class="l-box" style="background: #fca5a5;"></span>
            <span class="l-box" style="background: #ef4444;"></span>
        `;
    } else {
        document.getElementById("legendMinLabel").innerText = "Száraz";
        document.getElementById("legendMaxLabel").innerText = "Biztos eső";
        document.getElementById("legendColors").innerHTML = `
            <span class="l-box" style="background: #1e293b;"></span>
            <span class="l-box" style="background: #1d4ed8;"></span>
            <span class="l-box" style="background: #3b82f6;"></span>
            <span class="l-box" style="background: #93c5fd;"></span>
        `;
    }

    if (globalWeatherData) {
        renderHeatmap(globalWeatherData);
    }
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
    const heatmapWrapper = document.getElementById("heatmapWrapper");
    
    mainCard.innerHTML = `<div class="loading">Adatok frissítése...</div>`;
    hourlyScroll.innerHTML = "";
    dailyScroll.innerHTML = "";
    heatmapWrapper.innerHTML = "";

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=hu&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            mainCard.innerHTML = `<p style="color: #ef4444;">A megadott város nem található!</p>`;
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
        globalWeatherData = await weatherRes.json();
        globalWeatherData.cityName = name;
        globalWeatherData.country = country;

        displayWeather(globalWeatherData);
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

function displayWeather(data) {
    const mainCard = document.getElementById("weatherMain");
    const hourlyScroll = document.getElementById("hourlyScroll");
    const dailyScroll = document.getElementById("dailyScroll");
    
    const cityName = data.cityName;
    const country = data.country;
    const current = data.current;
    
    const nowIso = new Date().toISOString().slice(0, 13);
    let startIndex = 0;
    for (let i = 0; i < data.hourly.time.length; i++) {
        if (data.hourly.time[i].startsWith(nowIso)) {
            startIndex = i;
            break;
        }
    }

    const currentHourProb = data.hourly.precipitation_probability[startIndex] || 0;
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

    let hourlyHtml = '';
    for (let i = startIndex; i < startIndex + 36; i++) {
        if (!data.hourly.time[i]) break;

        const dateObj = new Date(data.hourly.time[i]);
        const timeStr = dateObj.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        const dayLabel = (i === startIndex) ? "Ma" : (dateObj.getHours() === 0 ? dateObj.toLocaleDateString('hu-HU', {month:'short', day:'numeric'}) : timeStr);
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

    document.getElementById("legendColors").innerHTML = `
        <span class="l-box" style="background: #3b82f6;"></span>
        <span class="l-box" style="background: #93c5fd;"></span>
        <span class="l-box" style="background: #fca5a5;"></span>
        <span class="l-box" style="background: #ef4444;"></span>
    `;

    renderHeatmap(data);
}

function renderHeatmap(data) {
    const heatmapWrapper = document.getElementById("heatmapWrapper");
    const detailBox = document.getElementById("heatmapDetail");
    const daily = data.daily;
    const todayStr = new Date().toISOString().split('T')[0];

    let gridHtml = '<div class="heatmap-grid">';
    
    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const isToday = dateStr === todayStr;
        
        let color = "#1e293b";
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;

        if (heatmapMode === "temp") {
            if (maxTemp < 0) color = "#1d4ed8";
            else if (maxTemp < 12) color = "#3b82f6";
            else if (maxTemp < 20) color = "#93c5fd";
            else if (maxTemp < 28) color = "#fca5a5";
            else color = "#ef4444";
        } else {
            if (rainProb < 15) color = "#1e293b";
            else if (rainProb < 40) color = "#1d4ed8";
            else if (rainProb < 75) color = "#3b82f6";
            else color = "#60a5fa";
        }

        gridHtml += `
            <div class="heatmap-square ${isToday ? 'today' : ''}" style="background-color: ${color};" data-index="${i}"></div>
        `;
    }

    gridHtml += '</div>';
    heatmapWrapper.innerHTML = gridHtml;

    const squares = heatmapWrapper.querySelectorAll(".heatmap-square");
    squares.forEach(sq => {
        sq.addEventListener("click", () => {
            const idx = sq.getAttribute("data-index");
            const dateStr = daily.time[idx];
            const dateObj = new Date(dateStr);
            const dayFormatted = dateObj.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'short' });
            const maxT = Math.round(daily.temperature_2m_max[idx]);
            const minT = Math.round(daily.temperature_2m_min[idx]);
            const rProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[idx] : 0;

            detailBox.style.display = "block";
            detailBox.innerHTML = `<strong>${dayFormatted}</strong><br>▲ Max: ${maxT}°C | ▼ Min: ${minT}°C | 💧 Eső esély: ${rProb}%`;
        });
    });
}

fetchWeatherData(currentCity);
