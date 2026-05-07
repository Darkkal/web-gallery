import Link from "next/link";
import { Home, ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                padding: "2rem",
                textAlign: "center",
            }}
        >
            <div
                style={{
                    background: "var(--glass-background)",
                    border: "1px solid var(--glass-border)",
                    backdropFilter: `blur(var(--glass-blur))`,
                    WebkitBackdropFilter: `blur(var(--glass-blur))`,
                    borderRadius: "var(--radius)",
                    padding: "3rem",
                    maxWidth: "500px",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1.5rem",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                }}
            >
                {/* Icon */}
                <div
                    style={{
                        background: "hsl(var(--primary) / 0.1)",
                        color: "hsl(var(--primary))",
                        width: "72px",
                        height: "72px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <SearchX size={36} />
                </div>

                {/* 404 number */}
                <h1
                    style={{
                        fontSize: "5rem",
                        fontWeight: 800,
                        lineHeight: 1,
                        background: `linear-gradient(to right, hsl(var(--primary)), hsl(263 70% 70%))`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    404
                </h1>

                {/* Description */}
                <div>
                    <h2
                        style={{
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            marginBottom: "0.5rem",
                        }}
                    >
                        Page not found
                    </h2>
                    <p style={{ color: "hsl(var(--muted-foreground))" }}>
                        The page you&apos;re looking for doesn&apos;t exist or has been moved.
                    </p>
                </div>

                {/* Navigation links */}
                <div
                    style={{
                        display: "flex",
                        gap: "1rem",
                        flexWrap: "wrap",
                        justifyContent: "center",
                    }}
                >
                    <Link
                        href="/timeline"
                        style={{
                            background: "hsl(var(--primary))",
                            color: "hsl(var(--primary-foreground))",
                            border: "none",
                            padding: "0.75rem 1.5rem",
                            borderRadius: "var(--radius)",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            textDecoration: "none",
                        }}
                    >
                        <Home size={18} />
                        Go to Timeline
                    </Link>
                    <Link
                        href="/gallery"
                        style={{
                            background: "hsl(var(--secondary))",
                            color: "hsl(var(--secondary-foreground))",
                            border: "1px solid hsl(var(--border))",
                            padding: "0.75rem 1.5rem",
                            borderRadius: "var(--radius)",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            textDecoration: "none",
                        }}
                    >
                        <ArrowLeft size={18} />
                        Go to Gallery
                    </Link>
                </div>
            </div>
        </div>
    );
}
