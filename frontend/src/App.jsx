import React, { useState } from 'react';
import { Search, Heart, Sparkles, ExternalLink, AlertCircle } from 'lucide-react';
import './App.css';

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [mascotMessage, setMascotMessage] = useState('¡Hola! ✨ ¿Qué se te antoja hoy?');
  const [mascotMood, setMascotMood] = useState('happy');
  const [error, setError] = useState(null);

  const foodSites = [
    { name: 'Just Eat', icon: '🍔', color: '#FF8000' },
    { name: 'Glovo', icon: '🛵', color: '#FFC244' },
    { name: 'Uber Eats', icon: '🍕', color: '#06C167' },
    { name: 'Deliveroo', icon: '🍜', color: '#00CCBC' }
  ];

  const handleSearch = async () => {
    if (!query.trim()) {
      setMascotMessage('¡Tienes que decirme qué quieres comer! 🥺');
      setMascotMood('sad');
      return;
    }

    setLoading(true);
    setError(null);
    setMascotMessage('¡Buscando cositas ricas para ti! 🔍✨');
    setMascotMood('searching');

    try {
      const response = await fetch('http://localhost:3001/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error('Error en el servidor');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data.products || []);
      setMascotMessage(data.interpretation?.mensaje || '¡Listo! ✨');
      setMascotMood(data.products.length > 0 ? 'excited' : 'sad');

    } catch (err) {
      console.error('Error:', err);
      setError(err.message);
      setMascotMessage('😢 Ups... ¿Está el backend corriendo?');
      setMascotMood('sad');
      setResults([]);
    }

    setLoading(false);
  };

  const getMascotExpression = () => {
    switch (mascotMood) {
      case 'happy': return '(◕‿◕)';
      case 'excited': return '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧';
      case 'searching': return '(｡◕‿◕｡)';
      case 'sad': return '(｡•́︿•̀｡)';
      default: return '(◕‿◕)';
    }
  };

  return (
    <div className="app">
      <div className="container">
        {/* Header con mascota */}
        <div className="header">
          <div className="mascot">
            <span className="mascot-face">{getMascotExpression()}</span>
          </div>
          <h1 className="title">Buscador Cuki de Comida</h1>
          <div className="mascot-bubble">
            <p>{mascotMessage}</p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="error-box">
            <AlertCircle size={24} />
            <div>
              <p className="error-title">Error de conexión</p>
              <p className="error-text">
                {error}. Asegúrate de que el backend esté corriendo en http://localhost:3001
              </p>
            </div>
          </div>
        )}

        {/* Barra de búsqueda */}
        <div className="search-box">
          <div className="search-input-container">
            <div className="input-wrapper">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ej: Quiero grasita 🍔, algo dulce 🍰, comida sana 🥗..."
                className="search-input"
              />
              <Sparkles className="input-icon" size={24} />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="search-button"
            >
              {loading ? (
                <>
                  <div className="spinner"></div>
                  Buscando...
                </>
              ) : (
                <>
                  <Search size={24} />
                  Buscar
                </>
              )}
            </button>
          </div>

          {/* Sitios que buscamos */}
          <div className="sites-list">
            <span className="sites-label">Buscando en:</span>
            {foodSites.map((site, idx) => (
              <span key={idx} className="site-badge">
                {site.icon} {site.name}
              </span>
            ))}
          </div>

          {/* Indicador de IA */}
          <div className="ai-badge-container">
            <span className="ai-badge">
              🤖 Powered by Ollama (llama3.1:8b)
            </span>
          </div>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="results-section">
            <div className="results-header">
              <h2 className="results-title">
                ¡Encontré {results.length} cositas ricas! ✨
              </h2>
              <div className="sort-badge">
                <span>Ordenado por precio 💰</span>
              </div>
            </div>

            <div className="results-grid">
              {results.map((result) => (
                <div key={result.id} className="product-card">
                  <div
                    className="product-color-bar"
                    style={{ backgroundColor: result.siteColor }}
                  ></div>

                  <div className="product-content">
                    <div className="product-header">
                      <span className="product-icon">{result.siteIcon}</span>
                      <span className="product-site-badge">
                        {result.site}
                      </span>
                    </div>

                    <h3 className="product-name">
                      {result.name}
                    </h3>

                    {result.restaurant && (
                      <p className="product-restaurant">
                        📍 {result.restaurant}
                      </p>
                    )}

                    <div className="product-info">
                      <span>⭐ {result.rating}</span>
                      <span>•</span>
                      <span>🕐 {result.deliveryTime}</span>
                    </div>

                    <div className="product-footer">
                      <div className="product-price">
                        €{typeof result.price === 'number' ? result.price.toFixed(2) : result.price}
                      </div>

                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="product-button"
                      >
                        Ver
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!loading && results.length === 0 && !error && (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <p className="empty-text">
              ¡Escribe qué se te antoja y yo buscaré las mejores opciones!
            </p>
            <div className="tip-box">
              <p>
                💡 <strong>Tip:</strong> Asegúrate de tener Ollama corriendo con el modelo llama3.1:8b
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer cuki */}
      <div className="footer">
        <Heart className="footer-heart" size={20} />
        <span>Hecho con amor y mucha hambre</span>
      </div>
    </div>
  );
}

export default App;