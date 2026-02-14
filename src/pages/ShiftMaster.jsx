import React from 'react';
import ShiftCalculator from '@/components/ShiftCalculator';
import CombinedReport from '@/components/CombinedReport';
import { ChefHat, UtensilsCrossed, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ShiftMaster() {
  const [showCombinedReport, setShowCombinedReport] = React.useState(false);
  const [chefsData, setChefsData] = React.useState(null);
  const [sousData, setSousData] = React.useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50" dir="rtl">
      <CombinedReport 
        isOpen={showCombinedReport}
        onClose={() => setShowCombinedReport(false)}
        chefsData={chefsData}
        sousData={sousData}
      />
      
      <header className="py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            מחשבון משמרות מטבח
          </h1>
          <p className="text-gray-500">
            תכנון וחישוב כיסוי משמרות שבועי
          </p>
          <Button
            onClick={() => setShowCombinedReport(true)}
            className="mt-4 bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          >
            <FileText className="h-4 w-4 ml-2" />
            דו״ח מאוחד - שפים וסושפים
          </Button>
        </div>
      </header>

      <main className="px-4 pb-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
          <ShiftCalculator 
            title="שפים"
            icon={ChefHat}
            accentColor="orange"
            onDataChange={setChefsData}
          />
          <ShiftCalculator 
            title="סו-שפים"
            icon={UtensilsCrossed}
            accentColor="blue"
            onDataChange={setSousData}
          />
        </div>
      </main>

      <footer className="text-center py-6 text-gray-400 text-sm">
        <p>משמרות יום: 06:00-22:00 | ערב: 22:00-02:00 | לילה: 02:00-06:00</p>
      </footer>
    </div>
  );
}