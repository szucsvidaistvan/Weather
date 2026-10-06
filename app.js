const defaultCity = "Debrecen";

document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if (city) fetchWeatherData(city);
});

document.getElementById("cityInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        const city = document.getElementById("cityInput").value.trim();
        if (city) fetchWeatherData(city);
    }
});

async function fetchWeatherData(cityName) {
    const mainCard = document.getElementById("weatherMain");
    const weeklyScroll = document.getElementById("weeklyScroll");
    
    mainCard.innerHTML = `<div class="loading">Keresés és adatok letöltése...</div>`;
    weeklyScroll.innerHTML = "";

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=hu&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            mainCard.innerHTML = `<p style="color: #ef4444;">A megadott város nem található!</p>`;
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&hourly=precipitation_probability,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`);
        const weatherData = await weatherRes.json();

        displayWeather(name, country, weatherData);
    } catch (error) {
        console.error(error);
        mainCard.innerHTML = `<p style="color: #ef4444;">Hiba történt az adatok letöltése közben.</p>`;
    }
}

function getWeatherInfo(code) {
    // Visszaadja a szöveget és az ikont
    const map = {
        0: { text: "Tiszta idő", icon: "☀️" },
        1: { text: "Főként tiszta", icon: "🌤️" },
        2: { text: "Változóan felhős", icon: "⛅" },
        3: { text: "Borult ég", icon: "☁️" },
        51: { text: "Szitálás", icon: "🌧️" },
        61: { text: "Enyhe eső", icon: "🌧️" },
        63: { text: "Mérsékelt eső", icon: "🌧️" },
        65: { text: "Intenzív esőzés", icon: "⛈️" },
        71: { text: "Hóesés", icon: "🌨️" },
        95: { text: "Zivatar", icon: "⚡" }
    };
    return map[code] || { text: "Változékony", icon: "⛅" };
}

function getHumanReadableRainText(probability, precipitation, cityName) {
    // Pontos magyarázat a területi lefedettségről, ahogy kérted:
    // Pl. 69% azt jelenti, hogy a város 69%-án esni fog, 31% eséllyel megússzák szárazon.
    let dryChance = 100 - probability;
    if (dryChance < 0) dryChance = 0;

    let intensityText = precipitation > 2 ? "kiadósabb, áztató jellegű" : "szitáló, szemerkélő";
    if (precipitation > 5) intensityText = "zivataros, felhőszakadalmas";

    return `<strong>Csapadék területi eloszlás:</strong> A modellek szerint ${cityName} területének <strong>${probability}%</strong>-án várható eső, míg a maradék <strong>${dryChance}%</strong>-on nagy eséllyel száraz marad az idő. Ahol esik, ott ${intensityText} csapadékra kell számítani.`;
}

function displayWeather(cityName, country, data) {
    const mainCard = document.getElementById("weatherMain");
    const weeklyScroll = document.getElementById("weeklyScroll");
    
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

    // Heti kártyák feltöltése (Időkép stílusú vízszintes sáv)
    const daily = data.daily;
    let cardsHtml = '';

    for (let i = 0; i < daily.time.length; i++) {
        const dateObj = new Date(daily.time[i]);
        const dayName = i === 0 ? "Ma" : dateObj.toLocaleDateString('hu-HU', { weekday: 'short', month: 'short', day: 'numeric' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const dayInfo = getWeatherInfo(daily.weather_code[i]);
        const rainProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 0;

        cardsHtml += `
            <div class="day-card">
                <div class="day-name">${dayName}</div>
                <div class="day-icon">${dayInfo.icon}</div>
                <div class="day-temps">
                    <span class="temp-max">▲ ${maxTemp}°C</span>
                    <span class="temp-min">▼ ${minTemp}°C</span>
                </div>
                <div class="day-rain">💧 ${rainProb}%</div>
            </div>
        `;
    }

    weeklyScroll.innerHTML = cardsHtml;
}

// Kezdő lekérdezés indításkor
fetchWeatherData(defaultCity);
