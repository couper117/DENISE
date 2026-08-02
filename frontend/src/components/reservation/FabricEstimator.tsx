import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Info } from 'lucide-react';

type EstimatorType = 'curtain' | 'attire';

const FabricEstimator = () => {
  const { t } = useTranslation();
  const [type, setType] = useState<EstimatorType>('curtain');
  const [inputs, setInputs] = useState({ width: '', height: '', windows: '1', panels: '2', fullness: '2.5', garmentType: 'top', size: 'M' });
  const [result, setResult] = useState<number | null>(null);

  const attireFabricMap: Record<string, Record<string, number>> = {
    dress: { S: 3.0, M: 3.5, L: 4.0, XL: 4.5, XXL: 5.0 },
    top: { S: 1.5, M: 1.8, L: 2.0, XL: 2.3, XXL: 2.5 },
    skirt: { S: 1.5, M: 1.8, L: 2.0, XL: 2.3, XXL: 2.5 },
    trousers: { S: 2.0, M: 2.3, L: 2.5, XL: 2.8, XXL: 3.0 },
    suit: { S: 3.5, M: 4.0, L: 4.5, XL: 5.0, XXL: 5.5 },
  };

  const calculate = () => {
    if (type === 'curtain') {
      const w = parseFloat(inputs.width) || 0;
      const h = parseFloat(inputs.height) || 0;
      const windows = parseInt(inputs.windows) || 1;
      const fullness = parseFloat(inputs.fullness) || 2.5;
      const panels = parseInt(inputs.panels) || 2;
      const hem = 0.3;
      const meters = ((w / 100 * fullness) * panels * ((h / 100) + hem)) * windows;
      setResult(Math.ceil(meters * 10) / 10);
    } else {
      const meters = attireFabricMap[inputs.garmentType]?.[inputs.size] || 2;
      setResult(meters);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={18} className="text-primary" />
        <h3 className="font-semibold">{t('reservation.estimator')}</h3>
      </div>

      {/* Type toggle */}
      <div className="flex gap-2 mb-4">
        {(['curtain', 'attire'] as EstimatorType[]).map((t_) => (
          <button key={t_} onClick={() => { setType(t_); setResult(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${type === t_ ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {t_ === 'curtain' ? '🪟 Curtain' : '👗 Traditional Attire'}
          </button>
        ))}
      </div>

      {type === 'curtain' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Window Width (cm)</label>
              <input type="number" value={inputs.width} onChange={(e) => setInputs(p => ({ ...p, width: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="200" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Window Height (cm)</label>
              <input type="number" value={inputs.height} onChange={(e) => setInputs(p => ({ ...p, height: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="250" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Windows</label>
              <input type="number" value={inputs.windows} onChange={(e) => setInputs(p => ({ ...p, windows: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="1" min="1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Panels/Window</label>
              <select value={inputs.panels} onChange={(e) => setInputs(p => ({ ...p, panels: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fullness</label>
              <select value={inputs.fullness} onChange={(e) => setInputs(p => ({ ...p, fullness: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="1.5">1.5x (Light)</option>
                <option value="2">2x (Standard)</option>
                <option value="2.5">2.5x (Full)</option>
                <option value="3">3x (Luxurious)</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Garment Type</label>
              <select value={inputs.garmentType} onChange={(e) => setInputs(p => ({ ...p, garmentType: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="dress">Dress</option>
                <option value="top">Top / Blouse</option>
                <option value="skirt">Skirt</option>
                <option value="trousers">Trousers</option>
                <option value="suit">Full Suit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Size</label>
              <select value={inputs.size} onChange={(e) => setInputs(p => ({ ...p, size: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                {['S', 'M', 'L', 'XL', 'XXL'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <button onClick={calculate} className="w-full mt-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
        Calculate Estimated Fabric
      </button>

      {result !== null && (
        <div className="mt-4 p-4 bg-primary/10 rounded-lg">
          <p className="text-center text-2xl font-bold text-primary">{result} meters</p>
          <p className="text-center text-xs text-muted-foreground mt-1">Estimated fabric required</p>
          <div className="flex items-start gap-2 mt-3 p-3 bg-background rounded-lg">
            <Info size={14} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">{t('reservation.estimator_note')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FabricEstimator;
