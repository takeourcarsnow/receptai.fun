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

app.post('/api/generate-recipe', async (req, res) => {
    try {
        const { ingredients } = req.body;
        
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ error: 'Invalid ingredients provided' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Define the prompt string
        const prompt = `
            Sukurk receptą naudojant šiuos ingredientus: ${ingredients.join(', ')}.
            
            Receptas turi būti originalus ir įdomus.
            Patiekalo pavadinimas turi būti paprastas ir tradicinis, naudojant tik tikrus lietuviškus žodžius.
            
            Tinkamų pavadinimų pavyzdžiai:
            - "Troškintos daržovės"
            - "Vištienos sriuba"
            - "Bulvių apkepas su sūriu"
            - "Daržovių salotos"
            - "Kepti baklažanai"
            
            Netinkamų pavadinimų pavyzdžiai:
            - "Sultingas salierų sukurukas" (sukurukas nėra žodis)
            - "Magiškas virtuvės šokis" (per daug poetiškas)
            - "Skanusis puodelis" (neaiškus pavadinimas)
            
            Instrukcijos turi būti labai detalios, įskaitant:
            - Tikslų ingredientų paruošimo būdą (pvz., "supjaustyti kubeliais 1x1 cm", "smulkiai sukapoti")
            - Konkrečią temperatūrą ir gaminimo laiką (pvz., "kepti 180°C temperatūroje 25 minutes")
            - Puodo ar keptuvės tipą ir dydį (pvz., "vidutinio dydžio nesvilančioje keptuvėje")
            - Kaitros lygį (pvz., "ant vidutinės kaitros")
            - Maišymo ar kitų veiksmų dažnumą (pvz., "maišyti kas 2-3 minutes")
            - Tekstūros ir išvaizdos požymius (pvz., "kol daržovės suminkštės, bet išliks traškios")
            - Kiekvieną žingsnį suskaidyti į smulkesnius veiksmus

            Pateik detalias instrukcijas ir naudingus patarimus.

            Atsakymą pateik JSON formatu:
            {
                "receptoPavadinimas": "Patiekalo pavadinimas",
                "gaminimoLaikas": "xx min",
                "sudetingumas": "Lengvas/Vidutinis/Sudėtingas",
                "porcijos": "x porcijos",
                "ingredientai": ["ingredientas 1 (kiekis)", "ingredientas 2 (kiekis)"],
                "instrukcijos": [
                    "<b>Paruošti ingredientus:</b> ...",
                    "<b>Įkaitinti orkaitę/keptuvę:</b> ...",
                    "<b>Sumaišyti produktus:</b> ...",
                    "<b>Gaminti/kepti:</b> ...",
                    "<b>Patiekti:</b> ..."
                ],
                "patarimai": ["patarimas 1", "patarimas 2"],
                "maistoInformacija": {
                    "kalorijos": "xxx kcal",
                    "baltymai": "xx g",
                    "angliavandeniai": "xx g",
                    "riebalai": "xx g"
                }
            }
        `;

        // Add timeout promise
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
        );

        const generatePromise = model.generateContent(prompt);
        
        // Race between the API call and timeout
        const result = await Promise.race([generatePromise, timeout]);
        
        if (!result || !result.response) {
            throw new Error('Invalid response from AI');
        }

        const response = result.response;
        let recipeText = response.text();

        // Clean up the response text
        recipeText = recipeText.replace(/```json\n?/, '')
                              .replace(/```\n?/, '')
                              .replace(/^\s+|\s+$/g, '');

        try {
            const recipe = JSON.parse(recipeText);
            
            // Validate recipe structure
            if (!recipe.receptoPavadinimas || !recipe.instrukcijos) {
                throw new Error('Invalid recipe format');
            }

            res.json(recipe);
        } catch (parseError) {
            if (process.env.NODE_ENV === 'development') {
                console.error('JSON parsing error:', parseError, '\nRaw text:', recipeText);
            }
            res.status(422).json({
                error: 'Nepavyko apdoroti recepto',
                details: 'Invalid JSON response'
            });
        }
    } catch (error) {
        console.error('Error generating recipe:', error);
        if (error.message.includes('503 Service Unavailable') || error.message.includes('overloaded')) {
            res.status(503).json({ error: 'Model overloaded. Please try again later.' });
        } else if (error.message.includes('500 Internal Server Error')) {
            res.status(500).json({
                error: 'An internal error occurred. Please retry or report in https://developers.generativeai.google/guide/troubleshooting'
            });
        } else {
            res.status(error.message === 'Request timeout' ? 504 : 500)
               .json({ 
                   error: error.message === 'Request timeout'
                       ? 'Užklausa užtruko per ilgai'
                       : 'Nepavyko sugeneruoti recepto'
               });
        }
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

module.exports = app;