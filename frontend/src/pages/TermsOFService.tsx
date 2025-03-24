import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";

const TermsOfService = () => {
  const [username, setUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUsername(userData.name);
      } catch (e) {
        console.error("Error parsing user data from localStorage");
      }
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar username={username} />
      <main className="flex-grow pt-32 pb-16">
        <div className="container max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

          <div className="space-y-6 text-foreground/80">
            <section>
              <h2 className="text-xl font-semibold mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using LazyCreator, you agree to be bound by
                these Terms of Service. If you do not agree to all the terms and
                conditions, you must not use our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                2. Description of Service
              </h2>
              <p>
                LazyCreator provides tools for creating YouTube Shorts videos.
                Our service helps users transform their ideas into engaging
                video content with minimal effort.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
              <p>
                You may need to create an account to use certain features of our
                service. You are responsible for maintaining the confidentiality
                of your account information and for all activities that occur
                under your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. User Content</h2>
              <p>
                You retain all rights to any content you submit, post, or
                display on or through LazyCreator. By submitting content, you
                grant us a worldwide, non-exclusive, royalty-free license to
                use, reproduce, modify, and distribute your content for the
                purpose of providing our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Prohibited Uses</h2>
              <p>
                You may not use LazyCreator for any illegal purpose or to
                violate any laws. You may not upload or share content that
                infringes on intellectual property rights, contains harmful
                code, or violates any person's rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Termination</h2>
              <p>
                We reserve the right to terminate or suspend your account and
                access to LazyCreator at our sole discretion, without notice,
                for conduct that we believe violates these Terms of Service or
                is harmful to other users, us, or third parties, or for any
                other reason.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Disclaimers</h2>
              <p>
                LazyCreator is provided "as is" without warranty of any kind. We
                do not guarantee that our service will be error-free or
                uninterrupted, or that any defects will be corrected.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                8. Limitation of Liability
              </h2>
              <p>
                In no event shall LazyCreator, its affiliates, or its licensors
                be liable for any indirect, incidental, special, consequential,
                or punitive damages, including without limitation, loss of
                profits, data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                9. Changes to Terms
              </h2>
              <p>
                We reserve the right to modify these Terms of Service at any
                time. We will provide notice of any significant changes by
                posting the new Terms of Service on this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
              <p>
                If you have any questions about these Terms of Service, please
                contact us at support@lazycreator.com.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
