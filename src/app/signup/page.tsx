import { AuthFooter, AuthForm } from "@/components/auth/auth-form";
import { Card, CardContent, CardHeader, CardTitle, TextLink } from "@/components/ui";

export default function SignupPage() {
  return (
    <main className="auth-page">
      <div className="auth-container">
        <header className="auth-header">
          <TextLink href="/" aria-label="Kembali ke beranda">←</TextLink>
          <span className="ui-wordmark"><span aria-hidden="true" className="ui-wordmark-mark">✦</span> Menitihari</span>
        </header>
        <Card className="auth-card">
          <CardHeader>
            <p className="ui-overline">Mulai perjalanan Anda</p>
            <CardTitle className="auth-title">Buat akun</CardTitle>
            <p className="ui-card-description">Mulai dengan uji coba 3 hari saat undangan pertama dibuat.</p>
          </CardHeader>
          <CardContent><AuthForm mode="signup" /></CardContent>
          <AuthFooter mode="signup" />
        </Card>
      </div>
    </main>
  );
}
