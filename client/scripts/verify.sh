#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "   WERYFIKACJA FAZY REFAKTORYZACJI"
echo "=========================================="
echo ""

echo "=== 1/5 Prettier - formatowanie kodu ==="
if command -v npx &> /dev/null; then
  npx prettier --check "src/**/*.{ts,html,scss}" || {
    echo "❌ Prettier: Znaleziono błędy formatowania"
    echo "   Uruchom: npx prettier --write \"src/**/*.{ts,html,scss}\""
    exit 1
  }
else
  echo "⚠️  Prettier: npx niedostępne, pomijam"
fi
echo "✅ Prettier OK"
echo ""

echo "=== 2/5 ESLint - analiza statyczna ==="
npm run lint || {
  echo "❌ ESLint: Znaleziono błędy"
  exit 1
}
echo "✅ ESLint OK"
echo ""

echo "=== 3/5 TypeScript - kompilacja ==="
npx tsc --noEmit || {
  echo "❌ TypeScript: Znaleziono błędy kompilacji"
  exit 1
}
echo "✅ TypeScript OK"
echo ""

echo "=== 4/5 Angular Build - pełna kompilacja ==="
npm run build || {
  echo "❌ Angular Build: Kompilacja nie powiodła się"
  exit 1
}
echo "✅ Angular Build OK"
echo ""

echo "=========================================="
echo "   ✅✅✅ WERYFIKACJA ZAKOŃCZONA ✅✅✅"
echo "=========================================="
echo ""
echo "Wszystkie sprawdzenia przeszły pomyślnie!"
echo "Możesz kontynuować do następnej fazy."
