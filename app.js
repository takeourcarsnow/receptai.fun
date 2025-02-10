require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Security and optimization middleware with relaxed settings for Vercel
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: false
}));

app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static files with proper MIME types
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Explicit routes for static files
app.get('/styles.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

app.get('/script.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public', 'script.js'));
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Ingredients database
const ingredients = {
    darzoves: [
        { name: "Pomidorai", emoji: "🍅" },
        { name: "Bulvės", emoji: "🥔" },
        { name: "Svogūnai", emoji: "🧅" },
        { name: "Morkos", emoji: "🥕" },
        { name: "Paprikos", emoji: "🫑" },
        { name: "Salotos", emoji: "🥬" },
        { name: "Agurkai", emoji: "🥒" },
        { name: "Brokoliai", emoji: "🥦" },
        { name: "Špinatai", emoji: "🍃" },
        { name: "Česnakai", emoji: "🧄" },
        { name: "Grybai", emoji: "🍄" },
        { name: "Cukinijos", emoji: "🥒" },
        { name: "Kopūstai", emoji: "🥬" },
        { name: "Salierai", emoji: "🥬" },
        { name: "Baklažanai", emoji: "🍆" }
    ],
    vaisiai: [
        { name: "Obuoliai", emoji: "🍎" },
        { name: "Bananai", emoji: "🍌" },
        { name: "Apelsinai", emoji: "🍊" },
        { name: "Citrina", emoji: "🍋" },
        { name: "Žalioji citrina", emoji: "🍋" },
        { name: "Braškės", emoji: "🍓" },
        { name: "Mėlynės", emoji: "🫐" },
        { name: "Vynuogės", emoji: "🍇" },
        { name: "Ananasai", emoji: "🍍" },
        { name: "Mangai", emoji: "🥭" },
        { name: "Kriaušės", emoji: "🍐" },
        { name: "Slyvos", emoji: "🫐" },
        { name: "Persikai", emoji: "🍑" },
        { name: "Abrikosai", emoji: "🍑" },
        { name: "Avietės", emoji: "🫐" }
    ],
    baltymai: [
        { name: "Vištiena", emoji: "🍗" },
        { name: "Jautiena", emoji: "🥩" },
        { name: "Kiauliena", emoji: "🥓" },
        { name: "Žuvis", emoji: "🐟" },
        { name: "Kiaušiniai", emoji: "🥚" },
        { name: "Tofu", emoji: "🧊" },
        { name: "Pupelės", emoji: "🫘" },
        { name: "Lęšiai", emoji: "🫘" },
        { name: "Malta mėsa", emoji: "🍖" },
        { name: "Krevetės", emoji: "🦐" },
        { name: "Tunas", emoji: "🐟" },
        { name: "Lašiša", emoji: "🐟" },
        { name: "Kalakutiena", emoji: "🦃" },
        { name: "Avinžirniai", emoji: "🫘" },
        { name: "Riešutai", emoji: "🥜" }
    ],
    pieno_produktai: [
        { name: "Pienas", emoji: "🥛" },
        { name: "Sūris", emoji: "🧀" },
        { name: "Jogurtas", emoji: "🥛" },
        { name: "Sviestas", emoji: "🧈" },
        { name: "Grietinėlė", emoji: "🥛" },
        { name: "Grietinė", emoji: "🥛" },
        { name: "Varškė", emoji: "🧀" },
        { name: "Plakamoji grietinėlė", emoji: "🥛" },
        { name: "Tepamas sūris", emoji: "🧀" },
        { name: "Mascarpone", emoji: "🧀" },
        { name: "Mocarela", emoji: "🧀" },
        { name: "Parmezanas", emoji: "🧀" },
        { name: "Feta", emoji: "🧀" },
        { name: "Kefyras", emoji: "🥛" }
    ],
    grudai: [
        { name: "Ryžiai", emoji: "🍚" },
        { name: "Makaronai", emoji: "🍝" },
        { name: "Duona", emoji: "🍞" },
        { name: "Miltai", emoji: "🌾" },
        { name: "Avižos", emoji: "🌾" },
        { name: "Bolivinė balanda", emoji: "🌾" },
        { name: "Kuskusas", emoji: "🌾" },
        { name: "Lakštiniai", emoji: "🍝" },
        { name: "Tortilijos", emoji: "🫓" },
        { name: "Grikiai", emoji: "🌾" },
        { name: "Perlinės kruopos", emoji: "🌾" },
        { name: "Manų kruopos", emoji: "🌾" },
        { name: "Speltos miltai", emoji: "🌾" }
    ],
    kiti_produktai: [
        { name: "Aliejus", emoji: "🫗" },
        { name: "Druska", emoji: "🧂" },
        { name: "Pipirai", emoji: "🌶️" },
        { name: "Cukrus", emoji: "🧂" },
        { name: "Actas", emoji: "🫗" },
        { name: "Sojos padažas", emoji: "🫗" },
        { name: "Pomidorų padažas", emoji: "🥫" },
        { name: "Prieskoniai", emoji: "🌿" },
        { name: "Medus", emoji: "🍯" },
        { name: "Majonezas", emoji: "🥚" },
        { name: "Garstyčios", emoji: "🟡" },
        { name: "Kečupas", emoji: "🥫" },
        { name: "Džemas", emoji: "🫐" },
        { name: "Uogienė", emoji: "🫐" },
        { name: "Šokoladas", emoji: "🍫" }
    ]
};

// Cache configuration
const priceCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// API Routes
app.get('/api/ingredients', (req, res) => {
    try {
        const ingredientsWithEmojis = {};
        for (const [category, items] of Object.entries(ingredients)) {
            ingredientsWithEmojis[category] = items.map(item => `${item.emoji} ${item.name}`);
        }
        res.json(ingredientsWithEmojis);
    } catch (error) {
        console.error('Error fetching ingredients:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/prices/:ingredient', async (req, res) => {
    try {
        const ingredient = req.params.ingredient;
        const ingredientWithoutEmoji = ingredient.replace(/^[^\s]+\s/, '');

        const cachedPrices = priceCache.get(ingredientWithoutEmoji);
        if (cachedPrices && cachedPrices.timestamp > Date.now() - CACHE_DURATION) {
            return res.json(cachedPrices.prices);
        }

        const prices = [
            {
                store: "Maxima",
                name: ingredientWithoutEmoji,
                price: "€" + (Math.random() * 5 + 1).toFixed(2),
                url: "https://www.maxima.lt"
            },
            {
                store: "Rimi",
                name: ingredientWithoutEmoji,
                price: "€" + (Math.random() * 5 + 1).toFixed(2),
                url: "https://www.rimi.lt"
            },
            {
                store: "Lidl",
                name: ingredientWithoutEmoji,
                price: "€" + (Math.random() * 5 + 1).toFixed(2),
                url: "https://www.lidl.lt"
            }
        ];

        priceCache.set(ingredientWithoutEmoji, {
            timestamp: Date.now(),
            prices: prices
        });

        res.json(prices);
    } catch (error) {
        console.error('Error fetching prices:', error);
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients } = req.body;
        
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ error: 'Invalid ingredients provided' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `
            Sukurk receptą naudojant šiuos ingredientus: ${ingredients.join(', ')}.
            
            Receptas turi būti originalus ir įdomus.
            Pateik detalias instrukcijas ir naudingus patarimus.

            Atsakymą pateik JSON formatu:
            {
                "receptoPavadinimas": "Patiekalo pavadinimas",
                "gaminimoLaikas": "xx min",
                "sudetingumas": "Lengvas/Vidutinis/Sudėtingas",
                "porcijos": "x porcijos",
                "ingredientai": ["ingredientas 1 (kiekis)", "ingredientas 2 (kiekis)"],
                "instrukcijos": ["1 žingsnis", "2 žingsnis"],
                "patarimai": ["patarimas 1", "patarimas 2"],
                "maistoInformacija": {
                    "kalorijos": "xxx kcal",
                    "baltymai": "xx g",
                    "angliavandeniai": "xx g",
                    "riebalai": "xx g"
                }
            }
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let recipeText = response.text();

        recipeText = recipeText.replace(/```json\n?/, '').replace(/```\n?/, '').trim();

        try {
            const recipe = JSON.parse(recipeText);
            res.json(recipe);
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            res.status(500).json({
                error: 'Failed to parse recipe',
                rawText: recipeText
            });
        }
    } catch (error) {
        console.error('Error generating recipe:', error);
        res.status(500).json({ error: 'Failed to generate recipe' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Server error', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
    });
}

// Periodic cache cleanup
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of priceCache.entries()) {
        if (value.timestamp < now - CACHE_DURATION) {
            priceCache.delete(key);
        }
    }
}, CACHE_DURATION);

module.exports = app;