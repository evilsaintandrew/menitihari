import { AuthFooter, AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardHeader, CardTitle, TextLink } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-container">
        <header className="auth-header">
          <TextLink href="/" aria-label="Kembali ke beranda">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card className="auth-card">
          <CardHeader>
            <p className="ui-overline">Selamat datang kembali</p>
            <CardTitle className="auth-title">Masuk</CardTitle>
            <p className="ui-card-description">Masuk untuk melanjutkan pengelolaan undangan Anda.</p>
          </CardHeader>
          <CardContent><AuthForm mode="login" /></CardContent>
          <AuthFooter mode="login" />
        </Card>
      </div>
    </main>
  );
}
