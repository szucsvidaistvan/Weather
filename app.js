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
    const card = document.getElementById("weatherCard");
    card.innerHTML = `<div class="loading">Keresés és adatok letöltése...</div>`;

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=hu&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            card.innerHTML = `<p style="color: red;">A megadott város nem található!</p>`;
            return;
        }

        const { latitude, longitude, name, country } = geoData.results[0];

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&hourly=precipitation_probability,precipitation&timezone=auto`);
        const weatherData = await weatherRes.json();

        displayWeather(name, country, weatherData);
    } catch (error) {
        console.error(error);
        card.innerHTML = `<p style="color: red;">Hiba történt az adatok betöltése közben.</p>`;
    }
}

function getWeatherDescription(code) {
    const codes = {
        0: "Tiszta idő",
        1: "Főként tiszta",
        2: "Változóan felhős",
        3: "Borult ég",
        51: "Gyenge szitálás",
        61: "Enyhe eső",
        63: "Mérsékelt eső",
        65: "Intenzív esőzés",
        71: "Enyhe hóesés",
        95: "Zivatar"
    };
    return codes[code] || "Változékony idő";
}

function getHumanReadableRainText(probability, precipitation) {
    let areaCoverage = "";
    if (probability < 20) {
        return "Csekély az esély a csapadékra, a város teljes területén száraz idő várható.";
    } else if (probability >= 20 && probability < 50) {
        areaCoverage = "A város kisebb körzeteiben (körülbelül 20-30%-án)";
    } else if (probability >= 50 && probability < 80) {
        areaCoverage = "A város nagyobb részén (körülbelül 50-70%-án)";
    } else {
        areaCoverage = "A város szinte egész területén (több mint 80%-án)";
    }

    let intensityText = precipitation > 2 ? "kiadósabb, áztató jellegű" : "szitáló, szemerkélő";
    if (precipitation > 5) intensityText = "zivataros, felhőszakadás jellegű";

    return `${areaCoverage} kell esőre számítani. Valószínűsége **${probability}%**, a jellegét tekintve ${intensityText} csapadék várható.`;
}

function displayWeather(cityName, country, data) {
    const card = document.getElementById("weatherCard");
    const current = data.current;
    const currentHourProb = data.hourly.precipitation_probability[0] || 0;
    
    const weatherText = getWeatherDescription(current.weather_code);
    const humanText = getHumanReadableRainText(currentHourProb, current.precipitation);

    card.innerHTML = `
        <div class="city-title">${cityName} <span style="font-size: 1rem; color: #6b7280;">(${country})</span></div>
        <div class="temp">${Math.round(current.temperature_2m)}°C</div>
        <div class="description">${weatherText} (Páratartalom: ${current.relative_humidity_2m}%)</div>
        
        <div class="human-forecast">
            <h3>Részletes helyzetkép:</h3>
            <p>${humanText}</p>
        </div>
    `;
}

fetchWeatherData(defaultCity);