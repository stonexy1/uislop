import { Button } from "./ui/button";

const features = [
  { icon: "🔥", title: "Lightning fast builds", description: "Ship in seconds with our blazing fast pipeline." },
  { icon: "💎", title: "Premium quality", description: "Best-in-class components for every team." },
  { icon: "🤖", title: "AI-powered insights", description: "Harness the power of machine learning." },
  { icon: "⚡", title: "Instant deploys", description: "Say goodbye to slow releases forever." },
  { icon: "🎯", title: "Precise targeting", description: "Reach new heights with smart segmentation." },
  { icon: "🚀", title: "Launch faster", description: "Take your startup to the next level today." },
];

export function Landing() {
  return (
    <main className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-center items-center flex flex-col px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">✨ Now with AI-powered workflows</span>
          <h1 className="mt-6 text-6xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Supercharge your workflow
          </h1>
          <p className="mt-6 text-lg text-white">
            Unleash the power of next-generation AI to transform the way your team builds, ships and scales products. Our
            platform gives you a seamless experience from idea to launch, with everything in one place.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <button className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3 text-white shadow-lg shadow-purple-500/50">
              Get Started
            </button>
            <a href="#" className="rounded-full px-8 py-3 text-white shadow-pink-500/40">
              Learn More
            </a>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <h2 className="text-4xl font-bold text-indigo-600">Elevate your brand</h2>
        <div className="mt-12 grid grid-cols-3 gap-8">
          <div className="rounded-3xl bg-white p-8 shadow-2xl">
            <div className="size-12 rounded-2xl bg-indigo-100 text-2xl">🚀</div>
            <h3 className="mt-4 text-xl font-semibold text-indigo-600">Game-changer analytics</h3>
            <p className="mt-2 text-gray-600">Revolutionize how you understand your customers.</p>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-2xl">
            <div className="size-12 rounded-2xl bg-indigo-100 text-2xl">⚡</div>
            <h3 className="mt-4 text-xl font-semibold text-indigo-600">Real-time sync</h3>
            <p className="mt-2 text-gray-600">Powerful, seamless, intuitive collaboration for everyone.</p>
          </div>
          <div className="rounded-3xl bg-white p-8 shadow-2xl">
            <div className="size-12 rounded-2xl bg-indigo-100 text-2xl">🎯</div>
            <h3 className="mt-4 text-xl font-semibold text-indigo-600">Smart automation</h3>
            <p className="mt-2 text-gray-600">Cutting-edge tools that work while you sleep.</p>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <h2 className="text-4xl font-bold">Everything you need</h2>
        <div className="mt-12 grid grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-violet-200 bg-white p-8">
              <div className="size-12 rounded-2xl bg-purple-100">{feature.icon}</div>
              <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-indigo-600 px-6 py-16 text-white">
        <div className="grid grid-cols-4 gap-8">
          <div>
            <div className="text-4xl font-bold">99.9%</div>
            <div className="text-sm">uptime guaranteed</div>
          </div>
          <div>
            <div className="text-4xl font-bold">10,000+</div>
            <div className="text-sm">happy users</div>
          </div>
          <div>
            <div className="text-4xl font-bold">4.9/5</div>
            <div className="text-sm">average rating</div>
          </div>
          <div>
            <div className="text-4xl font-bold">500+</div>
            <div className="text-sm">Trusted by 500+ companies</div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 p-10 text-white">
          <h2 className="text-3xl font-bold">Pro plan</h2>
          <p className="mt-4 text-5xl font-bold">$49</p>
          <a href="#" className="mt-6 inline-block rounded-full bg-white px-6 py-3 text-indigo-600">
            Start free trial
          </a>
        </div>
      </section>

      <section className="px-6 py-24">
        <blockquote className="text-xl text-gray-700">
          "Acme Corp transformed our pipeline. Lorem ipsum dolor sit amet, the onboarding took minutes and every single
          person on our team now ships twice as often as before, without any of the usual release-day stress at all."
        </blockquote>
        <div className="mt-6 flex items-center gap-4">
          <img src="https://i.pravatar.cc/80" alt="John Doe" className="size-12 rounded-full" />
          <div>
            <p className="font-semibold">John Doe</p>
            <p className="text-sm text-gray-500">CTO at Acme Corp</p>
          </div>
        </div>
        <img src="https://via.placeholder.com/150" alt="Product screenshot" className="mt-10 rounded-3xl" />
      </section>

      <footer className="bg-black text-white px-6 py-12">
        <nav className="flex gap-6">
          <a href="#">Product</a>
          <a href="#">Pricing</a>
          <a href="#">Company</a>
        </nav>
        <p className="mt-6 text-sm">© 2026 Acme. All rights reserved.</p>
        <Button className="mt-4 bg-indigo-600 text-white">Contact us</Button>
      </footer>
    </main>
  );
}
