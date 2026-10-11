const CITIES = [
  { name: 'Tbilisi', country: 'Georgia', founded: '5th century' },
  { name: 'Lisbon', country: 'Portugal', founded: '8th century BC' },
  { name: 'Kyoto', country: 'Japan', founded: '794' },
  { name: 'Oslo', country: 'Norway', founded: '1040' },
  { name: 'Quito', country: 'Ecuador', founded: '1534' },
  { name: 'Hanoi', country: 'Vietnam', founded: '1010' },
];

// One column on a phone, two from 640 pixels, three from 1024: the
// viewport decides, so the panel runs it in a frame of the width you pick.
export function CityCards() {
  return (
    <ul className="grid w-full grid-cols-1 gap-12 p-16 sm:grid-cols-2 lg:grid-cols-3">
      {CITIES.map((city) => {
        return (
          <li key={city.name} className="rounded-8 border-gray-6 bg-surface-raised border-1 p-12">
            <p className="text-15 font-600 text-gray-12">{city.name}</p>
            <p className="text-13/20 text-gray-11">
              {city.country} · founded {city.founded}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
