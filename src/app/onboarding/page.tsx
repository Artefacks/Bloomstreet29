export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Bienvenue sur Bloomstreet 1929
        </h1>
        <div className="space-y-6">
          <form
            className="space-y-4"
            method="POST"
            action="/api/onboarding/create-room"
          >
            <input type="hidden" name="action" value="create" />
            <div>
              <label htmlFor="duration" className="block text-sm font-medium mb-2">
                Durée de la compétition
              </label>
              <select
                id="duration"
                name="duration"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="7d"
              >
                <option value="1h">1 heure</option>
                <option value="1d">1 journée</option>
                <option value="7d">7 jours</option>
                <option value="30d">1 mois</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Créer une compétition
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">ou</span>
            </div>
          </div>

          <form
            className="space-y-4"
            method="POST"
            action="/api/onboarding/join-room"
          >
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-2">
                Code d&apos;invitation
              </label>
              <input
                type="text"
                id="code"
                name="code"
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ABC1234"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Rejoindre une compétition
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}