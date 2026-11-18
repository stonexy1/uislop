import { describe, expect, it } from "vitest";
import { runRule } from "../helpers";

describe("fake-ui/dead-link", () => {
  const rule = "fake-ui/dead-link";
  it("flags # and javascript: links", () => {
    expect(runRule(rule, '<a href="#">x</a>')[0]?.message).toBe('Dead link: href="#"');
    expect(runRule(rule, '<a href="javascript:void(0)">x</a>')).toHaveLength(1);
    expect(runRule(rule, '<Link to="#">x</Link>')).toHaveLength(1);
  });

  it("allows anchors, real handlers and toggles", () => {
    expect(runRule(rule, '<a href="#top">x</a>')).toHaveLength(0);
    expect(runRule(rule, '<a href="#" onClick={() => open()}>x</a>')).toHaveLength(0);
    expect(runRule(rule, '<a href="#" data-bs-toggle="modal">x</a>', "html")).toHaveLength(0);
  });
});

describe("fake-ui handlers", () => {
  it("flags empty and preventDefault-only handlers", () => {
    const rule = "fake-ui/noop-handler";
    expect(runRule(rule, "<button onClick={() => {}}>x</button>")[0]?.message).toBe("Button does nothing: onClick handler is empty");
    expect(runRule(rule, "<button onClick={() => null}>x</button>")).toHaveLength(1);
    expect(runRule(rule, "<form onSubmit={(e) => e.preventDefault()} />")).toHaveLength(1);
    expect(runRule(rule, "<button onClick={(e) => e.preventDefault()}>x</button>")).toHaveLength(0);
    expect(runRule(rule, '<button onclick="">x</button>', "html")).toHaveLength(1);
  });

  it("flags console and alert only handlers", () => {
    const rule = "fake-ui/console-handler";
    expect(runRule(rule, '<button onClick={() => console.log("hi")}>x</button>')[0]?.message).toBe("Handler only calls console.log");
    expect(runRule(rule, '<button onClick={() => alert("hi")}>x</button>')[0]?.message).toBe("Handler only calls alert");
    expect(runRule(rule, '<button onClick={() => { console.log("hi"); save(); }}>x</button>')).toHaveLength(0);
  });
});

describe("fake-ui/fake-metric", () => {
  const rule = "fake-ui/fake-metric";
  it.each([
    "<p>99.9% uptime</p>",
    "<p>Join 10,000+ happy users</p>",
    "<p>Rated 4.9/5</p>",
    "<p>Trusted by 500+ companies</p>",
    "<p>★★★★★</p>",
  ])("flags %s", (source) => {
    expect(runRule(rule, source)).toHaveLength(1);
  });

  it("flags a bare number whose sibling names the metric", () => {
    expect(runRule(rule, "<div><b>12k+</b><span>developers</span></div>")[0]?.message).toBe('Invented metric "12k+"');
  });

  it("ignores values from expressions", () => {
    expect(runRule(rule, "<p>{stats.users} users</p>")).toHaveLength(0);
  });
});

describe("fake-ui/placeholder-asset", () => {
  const rule = "fake-ui/placeholder-asset";
  it("flags placeholder hosts in attributes and CSS", () => {
    expect(runRule(rule, '<img src="https://via.placeholder.com/150" />')[0]?.message).toBe("Placeholder asset via.placeholder.com");
    expect(runRule(rule, '.a { background: url("https://picsum.photos/200"); }', "css")).toHaveLength(1);
    expect(runRule(rule, '<img src="/images/team.jpg" />')).toHaveLength(0);
  });
});
