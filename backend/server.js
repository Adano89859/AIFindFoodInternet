// server.js - Backend con Express, Ollama y DuckDuckGo
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = 'http://localhost:11434/api/generate';

// Función para hablar con Ollama
async function askOllama(prompt) {
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: 'llama3.1:8b',
      prompt: prompt,
      stream: false,
      temperature: 0.7
    });
    return response.data.response;
  } catch (error) {
    console.error('Error con Ollama:', error.message);
    throw new Error('No se pudo conectar con Ollama. ¿Está corriendo?');
  }
}

// Función para buscar en DuckDuckGo (alternativa gratuita)
async function searchDuckDuckGo(query) {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });

    // Parseo básico del HTML de DuckDuckGo
    const html = response.data;
    const results = [];

    // Buscar enlaces en el HTML
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
    let match;

    while ((match = linkRegex.exec(html)) !== null && results.length < 10) {
      const url = match[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, '').split('&')[0];
      const title = match[2].trim();

      if (url && title && !url.includes('duckduckgo.com')) {
        results.push({
          title: decodeURIComponent(title),
          url: decodeURIComponent(url),
          description: title
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error en búsqueda web:', error.message);
    return [];
  }
}

// Endpoint principal de búsqueda
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query requerido' });
    }

    console.log(`\n🔍 Búsqueda iniciada: "${query}"`);

    // PASO 1: Preguntarle a Ollama qué buscar
    console.log('📝 Paso 1: Interpretando con IA local...');
    const interpretPrompt = `Eres un asistente cuki que ayuda a buscar comida a domicilio. El usuario dice: "${query}"

Tu tarea es interpretar qué tipo de comida quiere y generar términos de búsqueda.

Responde SOLO con un JSON (sin markdown, sin explicaciones) en este formato:
{
  "categoria": "tipo de comida",
  "terminos_busqueda": ["término1", "término2", "término3"],
  "emoji": "emoji",
  "mensaje": "mensaje divertido y cuki para el usuario"
}

Ejemplos:
- "grasita" → {"categoria": "comida rápida", "terminos_busqueda": ["hamburguesas", "pizza", "frituras"], "emoji": "🍔", "mensaje": "¡Uy sí! Grasita rica incoming 🍕✨"}
- "algo dulce" → {"categoria": "postres", "terminos_busqueda": ["postres", "helados", "tartas"], "emoji": "🍰", "mensaje": "¡Mmm dulzura! 🍦💕"}`;

    const interpretResponse = await askOllama(interpretPrompt);
    console.log('✅ Respuesta de Ollama:', interpretResponse);

    // Extraer JSON
    const jsonMatch = interpretResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Ollama no devolvió un JSON válido');
    }
    const interpretation = JSON.parse(jsonMatch[0]);

    // PASO 2: Buscar en internet
    console.log('🌐 Paso 2: Buscando en internet...');
    const searchQueries = [
      `${interpretation.terminos_busqueda[0]} just eat españa precio`,
      `${interpretation.terminos_busqueda[0]} glovo madrid`,
      `${interpretation.terminos_busqueda[1]} uber eats delivery`
    ];

    let allResults = [];
    for (const searchQuery of searchQueries) {
      console.log(`   Buscando: ${searchQuery}`);
      const results = await searchDuckDuckGo(searchQuery);
      allResults = allResults.concat(results.slice(0, 4));
    }

    console.log(`   Encontrados ${allResults.length} resultados`);

    if (allResults.length === 0) {
      // Si no hay resultados, generar productos basados solo en la interpretación
      console.log('⚠️ No hay resultados web, generando productos genéricos...');
      const fallbackProducts = generateFallbackProducts(interpretation);
      return res.json({
        interpretation,
        products: fallbackProducts,
        message: interpretation.mensaje
      });
    }

    // PASO 3: Ollama analiza los resultados
    console.log('🤖 Paso 3: Analizando resultados con IA...');
    const resultsText = allResults.map((r, i) =>
      `[${i}] ${r.title} - ${r.url}`
    ).join('\n');

    const analysisPrompt = `Analiza estos resultados de búsqueda sobre "${interpretation.categoria}".

RESULTADOS:
${resultsText}

Genera entre 6-10 productos de comida basándote en esto. Sé creativo pero realista.

Responde SOLO con JSON (sin markdown):
{
  "productos": [
    {
      "nombre": "Hamburguesa Doble con Queso",
      "restaurante": "Burger King",
      "precio_estimado": 9.99,
      "sitio": "just eat",
      "url": "url_real_del_resultado_si_disponible",
      "tiempo_entrega": "25-35 min"
    }
  ]
}

IMPORTANTE:
- Usa URLs reales de los resultados cuando sea posible
- Precios realistas en euros (5-25€)
- Mínimo 6 productos variados
- Nombres atractivos`;

    const analysisResponse = await askOllama(analysisPrompt);
    console.log('✅ Análisis completado');

    const analysisJsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
    if (!analysisJsonMatch) {
      throw new Error('Ollama no devolvió productos válidos');
    }
    const analysis = JSON.parse(analysisJsonMatch[0]);

    // PASO 4: Enriquecer productos
    const enrichedProducts = analysis.productos.map((p, idx) => ({
      id: idx,
      name: p.nombre,
      restaurant: p.restaurante || 'Restaurante Local',
      site: p.sitio || 'delivery',
      price: parseFloat(p.precio_estimado) || (8 + Math.random() * 12),
      rating: (4 + Math.random()).toFixed(1),
      deliveryTime: p.tiempo_entrega || `${20 + Math.floor(Math.random() * 20)}-${30 + Math.floor(Math.random() * 20)} min`,
      url: p.url || (allResults[idx % allResults.length]?.url || '#'),
      siteIcon: getSiteIcon(p.sitio),
      siteColor: getSiteColor(p.sitio)
    }));

    enrichedProducts.sort((a, b) => a.price - b.price);

    console.log(`✅ ¡Listo! ${enrichedProducts.length} productos encontrados\n`);

    res.json({
      interpretation,
      products: enrichedProducts,
      message: interpretation.mensaje
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      error: error.message,
      interpretation: {
        mensaje: '😢 Ups, algo salió mal. ¿Ollama está corriendo en el puerto 11434?',
        emoji: '😢'
      },
      products: []
    });
  }
});

// Generar productos de respaldo cuando no hay resultados web
function generateFallbackProducts(interpretation) {
  const baseProducts = {
    'comida rápida': [
      { name: 'Hamburguesa Clásica', rest: 'Burger King', price: 8.99 },
      { name: 'Pizza Margarita', rest: 'Telepizza', price: 9.50 },
      { name: 'Nuggets de Pollo', rest: 'McDonald\'s', price: 6.99 },
      { name: 'Hot Dog XXL', rest: 'Five Guys', price: 7.50 },
      { name: 'Burrito Mexicano', rest: 'Taco Bell', price: 8.50 },
      { name: 'Patatas Deluxe', rest: 'KFC', price: 5.99 }
    ],
    'postres': [
      { name: 'Tarta de Chocolate', rest: 'Granier', price: 12.50 },
      { name: 'Helado Cookies', rest: 'Ben & Jerry\'s', price: 8.99 },
      { name: 'Brownie con Helado', rest: 'VIPS', price: 9.50 },
      { name: 'Donuts Variados', rest: 'Dunkin', price: 7.99 },
      { name: 'Cheesecake NY', rest: 'La Tagliatella', price: 11.50 }
    ],
    'default': [
      { name: 'Menú del Día', rest: 'Restaurante Local', price: 12.00 },
      { name: 'Plato Combinado', rest: 'Bar Manolo', price: 10.50 },
      { name: 'Bocadillo Especial', rest: 'Cafetería Central', price: 6.50 }
    ]
  };

  const category = interpretation.categoria.toLowerCase();
  const products = baseProducts[category] || baseProducts['default'];

  return products.map((p, idx) => ({
    id: idx,
    name: p.name,
    restaurant: p.rest,
    site: 'delivery',
    price: p.price,
    rating: (4.2 + Math.random() * 0.7).toFixed(1),
    deliveryTime: `${20 + Math.floor(Math.random() * 20)}-${35 + Math.floor(Math.random() * 15)} min`,
    url: '#',
    siteIcon: '🍽️',
    siteColor: '#9333EA'
  }));
}

function getSiteIcon(siteName) {
  const icons = {
    'just eat': '🍔', 'glovo': '🛵', 'uber eats': '🍕',
    'deliveroo': '🍜', 'delivery': '🍽️'
  };
  const name = (siteName || '').toLowerCase();
  for (const [key, icon] of Object.entries(icons)) {
    if (name.includes(key)) return icon;
  }
  return '🍽️';
}

function getSiteColor(siteName) {
  const colors = {
    'just eat': '#FF8000', 'glovo': '#FFC244',
    'uber eats': '#06C167', 'deliveroo': '#00CCBC'
  };
  const name = (siteName || '').toLowerCase();
  for (const [key, color] of Object.entries(colors)) {
    if (name.includes(key)) return color;
  }
  return '#9333EA';
}

// Health check
app.get('/health', async (req, res) => {
  try {
    await axios.get('http://localhost:11434');
    res.json({ status: 'ok', ollama: 'connected' });
  } catch (error) {
    res.json({ status: 'degraded', ollama: 'disconnected' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🍕 Backend Cuki Iniciado 🍕         ║
╚════════════════════════════════════════╝
🚀 Servidor: http://localhost:${PORT}
📡 Ollama: http://localhost:11434
🔍 Buscador web: DuckDuckGo
✨ Listo para buscar comida deliciosa
  `);
});

module.exports = app;