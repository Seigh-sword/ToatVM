# Terms of Use

## 1. Acceptance of Terms

By accessing or using ToatCloud Terminal (the "Service"), you agree to be bound
by these Terms of Use. If you do not agree to these terms, please do not use
the Service.

## 2. Description of Service

ToatCloud Terminal provides a browser-based terminal experience by dispatching
GitHub Actions workflows that run Docker containers on GitHub-hosted runners.
The Service includes:

- A web client that displays a terminal in your browser
- A CLI tool for managing VM sessions
- GitHub Actions workflows that run the actual VM infrastructure

## 3. Eligibility

You must be at least 13 years old to use this Service. By using the Service,
you represent and warrant that you meet this age requirement.

## 4. Accounts

To use the Service, you must:

- Have a GitHub account
- Create a GitHub Personal Access Token (PAT) with `repo` and `workflow` scopes
- Provide accurate and complete information when creating an account

You are responsible for:

- Maintaining the confidentiality of your PAT
- All activities that occur under your account
- Notifying us immediately of any unauthorized use

## 5. Acceptable Use

You agree not to:

- Use the Service for any illegal purpose or in violation of any laws
- Use the Service to mine cryptocurrency, run botnets, or perform DDoS attacks
- Use the Service to access or attempt to access systems or data without permission
- Interfere with or disrupt the integrity or performance of the Service
- Attempt to gain unauthorized access to the Service or its related systems
- Use the Service to store, transmit, or distribute malicious code
- Violate GitHub's Acceptable Use Policy or Terms of Service

## 6. GitHub Actions Usage

The Service relies on GitHub Actions. You acknowledge that:

- GitHub Actions runners are ephemeral and may be reclaimed at any time
- Sessions have a hard cap of approximately 6 hours per run
- Sessions auto-restart every cycle (default 60 minutes) from cached state
- The tunnel URL is public and should be treated as a secret
- Anyone with the tunnel URL can access the VM
- The shell account password is printed in Actions logs (visible for public repos)

## 7. Security

- The tunnel URL is the only authentication mechanism (unless you set a share password)
- Use `toatvm -share` or the web interface to set a password for the tunnel
- Do not store sensitive data, secrets, or credentials on the VM
- Be aware that public repositories expose Actions logs to the internet
- The Service does not encrypt data at rest on the runner

## 8. Intellectual Property

- The Service is licensed under the Apache License, Version 2.0
- You retain ownership of any code or data you run on the VM
- We do not claim ownership of your work

## 9. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT.

WE DO NOT WARRANT THAT:

- THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE
- THE RESULTS OBTAINED FROM THE USE OF THE SERVICE WILL BE ACCURATE OR RELIABLE
- ANY DEFECTS OR ERRORS IN THE SERVICE WILL BE CORRECTED

## 10. Limitation of Liability

IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR
OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SERVICE OR THE USE
OR OTHER DEALINGS IN THE SERVICE.

## 11. Indemnification

You agree to indemnify and hold harmless the authors and contributors of
ToatCloud Terminal from any claims, damages, losses, or expenses (including
attorneys' fees) arising out of or in connection with your use of the Service.

## 12. Modifications to Service

We reserve the right to modify, suspend, or discontinue the Service at any time
without notice. We shall not be liable to you or any third party for any
modification, suspension, or discontinuation of the Service.

## 13. Changes to Terms

We may update these Terms of Use from time to time. We will notify users of any
material changes by posting the new Terms of Use on this page. Your continued
use of the Service after any such changes constitutes your acceptance of the new
terms.

## 14. Termination

We reserve the right to terminate or suspend your access to the Service at our
sole discretion, without notice, for conduct that we believe violates these
Terms of Use or is harmful to other users, us, or third parties.

## 15. Governing Law

These Terms of Use shall be governed by and construed in accordance with the
laws of the jurisdiction in which the project maintainers reside, without regard
to its conflict of law provisions.

## 16. Contact

If you have any questions about these Terms of Use, please contact us at
zack.yt.7085@gmail.com.
