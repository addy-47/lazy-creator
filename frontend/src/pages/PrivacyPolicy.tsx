import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useState, useEffect } from "react";

const PrivacyPolicy = () => {
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
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

          <div className="space-y-6 text-foreground/80">
            <section>
              <h2 className="text-xl font-semibold mb-3">
                1. Information We Collect
              </h2>
              <p>
                We collect information you provide directly to us when you
                create an account, use our service, or communicate with us. This
                may include your name, email address, and any content you create
                or upload through our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                2. How We Use Your Information
              </h2>
              <p>
                We use the information we collect to provide, maintain, and
                improve our services, to process your requests, and to
                communicate with you. We may also use your information to
                monitor and analyze usage patterns and to enhance the safety and
                security of our service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                3. Sharing of Information
              </h2>
              <p>
                We do not share your personal information with third parties
                except as described in this Privacy Policy. We may share your
                information with service providers who perform services on our
                behalf, when required by law, or to protect our rights and the
                rights of others.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to
                fulfill the purposes outlined in this Privacy Policy, unless a
                longer retention period is required or permitted by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Security</h2>
              <p>
                We take reasonable measures to help protect your personal
                information from loss, theft, misuse, unauthorized access,
                disclosure, alteration, and destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                6. Cookies and Similar Technologies
              </h2>
              <p>
                We use cookies and similar technologies to collect information
                about your activity, browser, and device. You can manage your
                cookie preferences through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
              <p>
                Depending on your location, you may have certain rights
                regarding your personal information, such as the right to
                access, correct, or delete your personal information. To
                exercise these rights, please contact us at
                privacy@lazycreator.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                8. Children's Privacy
              </h2>
              <p>
                Our service is not directed to children under 13, and we do not
                knowingly collect personal information from children under 13.
                If we learn that we have collected personal information from a
                child under 13, we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">
                9. Changes to This Privacy Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please
                contact us at privacy@lazycreator.com.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
