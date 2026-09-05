pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        // Verification runs before Build so a broken change cannot reach the
        // deploy stage.
        stage('Typecheck') {
            steps {
                sh 'npx tsc --noEmit'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                // Outbound credentials are blanked in tests/setup.ts, so the
                // suite cannot reach a real Discord channel or inbox.
                sh 'npm test'
            }
        }

        stage('Audit') {
            steps {
                // Advisory: report known vulnerabilities without failing the
                // build on a disclosure published mid-deploy.
                sh 'npm audit --omit=dev --audit-level=high || true'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Deploy') {
            // Restart production only from the default branch.
            when {
                branch 'main'
            }
            steps {
                sh 'sudo -u aza PM2_HOME=/home/aza/.pm2 pm2 restart cloudy-relay-api'
            }
        }

        stage('Smoke check') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                  # Read the port the service actually listens on rather than
                  # assuming a default.
                  APP_PORT="$(grep -E "^PORT=" .env 2>/dev/null | head -1 | cut -d= -f2 | tr -d "\\r\\n \\"'" )"
                  APP_PORT="${APP_PORT:-5001}"
                  echo "checking health on port $APP_PORT"

                  for i in $(seq 1 10); do
                    if curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/api/health" > /dev/null; then
                      echo "health check passed"
                      exit 0
                    fi
                    sleep 3
                  done
                  echo "service did not report healthy on port $APP_PORT after restart"
                  exit 1
                '''
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed — production was not restarted unless Deploy had already run.'
        }
    }
}
