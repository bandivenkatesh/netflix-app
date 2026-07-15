pipeline {
  agent {
    label 'built-in'
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timestamps()
  }

  environment {
    APP_REPO_URL               = 'https://github.com/bandivenkatesh/netflix-app.git'
    DEPLOYMENT_REPO_URL        = 'https://github.com/bandi2-dev/netflix-deployment.git'
    GCP_PROJECT                = 'godl-production'
    GCP_REGION                 = 'us-central1-a'
    GKE_CLUSTER                = 'netflix-gke-dev'
    K8S_NAMESPACE              = 'dev'
    RELEASE_NAME               = 'netflix'
    STORAGE_CLASS              = 'standard-rwo'
    ARTIFACT_REGISTRY          = 'us-central1-docker.pkg.dev/godl-production/netflix-dev'
    BACKEND_IMAGE              = 'us-central1-docker.pkg.dev/godl-production/netflix-dev/netflix-backend'
    FRONTEND_IMAGE             = 'us-central1-docker.pkg.dev/godl-production/netflix-dev/netflix-frontend'
    SONAR_HOST_URL             = 'http://34.144.208.30/sonarqube'
    SONAR_BACKEND_PROJECT_KEY  = 'netflix-clone-backend-dev'
    SONAR_FRONTEND_PROJECT_KEY = 'netflix-clone-frontend-dev'
  }

  stages {
    stage('Environment Info') {
      steps {
        sh '''
          set +e
          java -version
          mvn -version
          node --version
          npm --version
          kubectl version --client
          helm version
          gcloud version
          git --version
          yq --version
        '''
      }
    }

    stage('Checkout Application Repository') {
      steps {
        deleteDir()
        checkout scm
        stash name: 'app-source', includes: 'backend/**,frontend/**,Jenkinsfile', excludes: '**/target/**,**/node_modules/**,**/dist/**', useDefaultExcludes: false
      }
    }

    stage('Backend Build') {
      steps {
        sh '''
          set -eu
          mvn -f backend/pom.xml -B clean package -DskipTests=true
        '''
      }
    }

    stage('Frontend Build') {
      steps {
        dir('frontend') {
          sh '''
            set -eu
            npm ci
            npm run build
          '''
        }
      }
    }

    stage('SonarQube Analysis') {
      steps {
        withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            set -eu

            mvn -f backend/pom.xml -B sonar:sonar \
              -DskipTests=true \
              -Dsonar.projectKey=${SONAR_BACKEND_PROJECT_KEY} \
              -Dsonar.projectName="Netflix Clone Backend Dev" \
              -Dsonar.projectVersion=${BUILD_NUMBER} \
              -Dsonar.host.url=${SONAR_HOST_URL} \
              -Dsonar.token=${SONAR_TOKEN}

            cat > frontend/pom-sonar.xml <<'EOF'
            <project xmlns="http://maven.apache.org/POM/4.0.0"
                     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                     xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
              <modelVersion>4.0.0</modelVersion>
              <groupId>ci</groupId>
              <artifactId>netflix-frontend-sonar</artifactId>
              <version>1.0.0</version>
              <packaging>pom</packaging>
            </project>
            EOF

            mvn -f frontend/pom-sonar.xml -B org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \
              -Dsonar.projectKey=${SONAR_FRONTEND_PROJECT_KEY} \
              -Dsonar.projectName="Netflix Clone Frontend Dev" \
              -Dsonar.projectVersion=${BUILD_NUMBER} \
              -Dsonar.host.url=${SONAR_HOST_URL} \
              -Dsonar.token=${SONAR_TOKEN} \
              -Dsonar.projectBaseDir=${WORKSPACE}/frontend \
              -Dsonar.sources=src \
              -Dsonar.exclusions=node_modules/**,dist/** \
              -Dsonar.sourceEncoding=UTF-8
          '''
        }
      }
    }

    stage('Quality Gate') {
      steps {
        withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            set +e

            fetch_url() {
              if command -v curl >/dev/null 2>&1; then
                curl -sS -u "${SONAR_TOKEN}:" "$1"
              elif command -v wget >/dev/null 2>&1; then
                AUTH_HEADER="$(printf "%s:" "${SONAR_TOKEN}" | base64 | tr -d '\\n')"
                wget -qO- --header="Authorization: Basic ${AUTH_HEADER}" "$1"
              else
                echo "Neither curl nor wget is available for SonarQube API checks."
                exit 1
              fi
            }

            check_quality_gate() {
              REPORT_FILE="$1"
              COMPONENT="$2"
              ALLOW_MISSING="$3"

              if [ ! -f "${REPORT_FILE}" ]; then
                if [ "${ALLOW_MISSING}" = "true" ]; then
                  echo "WARNING: Missing Sonar report task file for ${COMPONENT} (${REPORT_FILE}). Skipping check."
                  return 0
                else
                  echo "ERROR: Missing Sonar report task file for ${COMPONENT}: ${REPORT_FILE}"
                  exit 1
                fi
              fi

              CE_TASK_URL="$(grep '^ceTaskUrl=' "${REPORT_FILE}" | cut -d= -f2-)"
              if [ -z "${CE_TASK_URL}" ]; then
                echo "Missing ceTaskUrl for ${COMPONENT}"
                exit 1
              fi

              ANALYSIS_ID=""
              ATTEMPT=0
              MAX_ATTEMPTS=60

              while [ "${ATTEMPT}" -lt "${MAX_ATTEMPTS}" ]; do
                RESPONSE="$(fetch_url "${CE_TASK_URL}")"
                TASK_STATUS="$(echo "${RESPONSE}" | sed -n 's/.*"status":"\\([^"]*\\)".*/\\1/p' | head -n 1)"
                ANALYSIS_ID="$(echo "${RESPONSE}" | sed -n 's/.*"analysisId":"\\([^"]*\\)".*/\\1/p' | head -n 1)"

                if [ "${TASK_STATUS}" = "SUCCESS" ] && [ -n "${ANALYSIS_ID}" ]; then
                  break
                fi

                if [ "${TASK_STATUS}" = "FAILED" ] || [ "${TASK_STATUS}" = "CANCELED" ]; then
                  echo "SonarQube compute task failed for ${COMPONENT} with status ${TASK_STATUS}"
                  exit 1
                fi

                ATTEMPT=$((ATTEMPT + 1))
                sleep 10
              done

              if [ -z "${ANALYSIS_ID}" ]; then
                echo "Timed out waiting for SonarQube analysis completion for ${COMPONENT}"
                exit 1
              fi

              QG_RESPONSE="$(fetch_url "${SONAR_HOST_URL}/api/qualitygates/project_status?analysisId=${ANALYSIS_ID}")"
              QG_STATUS="$(echo "${QG_RESPONSE}" | sed -n 's/.*"status":"\\([^"]*\\)".*/\\1/p' | head -n 1)"

              if [ "${QG_STATUS}" != "OK" ]; then
                echo "Quality Gate failed for ${COMPONENT}: ${QG_STATUS}"
                exit 1
              fi

              echo "Quality Gate passed for ${COMPONENT}: ${QG_STATUS}"
            }

            # STRICT: Backend must exist and pass
            check_quality_gate "backend/target/sonar/report-task.txt" "backend" "false"
            
            # FLEXIBLE: Frontend will warn but won't break the build if the file is missing
            check_quality_gate "frontend/.scannerwork/report-task.txt" "frontend" "true"
          '''
        }
      }
    }

    stage('Authenticate to Google Cloud') {
      steps {
        withCredentials([file(credentialsId: 'gcp-service-account', variable: 'GCP_SA_KEY')]) {
          sh '''
            set -eu
            gcloud auth activate-service-account --key-file="${GCP_SA_KEY}"
            gcloud config set project "${GCP_PROJECT}"
            gcloud config set compute/region "${GCP_REGION}"
            gcloud container clusters get-credentials "${GKE_CLUSTER}" --region "${GCP_REGION}" --project "${GCP_PROJECT}"
            kubectl config current-context
          '''
        }
      }
    }

    stage('Build Backend Docker Image using Kaniko') {
      agent {
        kubernetes {
          inheritFrom 'kaniko'
        }
      }
      steps {
        deleteDir()
        unstash 'app-source'
        container(name: 'kaniko', shell: '/busybox/sh') {
          sh '''
            set -eu
            /kaniko/executor \
              --context=dir://${WORKSPACE}/backend \
              --dockerfile=${WORKSPACE}/backend/Dockerfile \
              --destination=${BACKEND_IMAGE}:${BUILD_NUMBER} \
              --cache=true \
              --cleanup \
              --digest-file=${WORKSPACE}/backend-image-digest.txt
          '''
        }
        stash name: 'backend-digest', includes: 'backend-image-digest.txt'
      }
    }

    stage('Push Backend Image') {
      steps {
        unstash 'backend-digest'
        script {
          def backendDigest = readFile('backend-image-digest.txt').trim()
          if (!backendDigest) {
            error('Backend image push verification failed: digest file is empty.')
          }
          echo "Backend image digest: ${backendDigest}"
        }
      }
    }

    stage('Build Frontend Docker Image using Kaniko') {
      agent {
        kubernetes {
          inheritFrom 'kaniko'
        }
      }
      steps {
        deleteDir()
        unstash 'app-source'
        container(name: 'kaniko', shell: '/busybox/sh') {
          sh '''
            set -eu
            /kaniko/executor \
              --context=dir://${WORKSPACE}/frontend \
              --dockerfile=${WORKSPACE}/frontend/Dockerfile \
              --destination=${FRONTEND_IMAGE}:${BUILD_NUMBER} \
              --cache=true \
              --cleanup \
              --digest-file=${WORKSPACE}/frontend-image-digest.txt
          '''
        }
        stash name: 'frontend-digest', includes: 'frontend-image-digest.txt'
      }
    }

    stage('Push Frontend Image') {
      steps {
        unstash 'frontend-digest'
        script {
          def frontendDigest = readFile('frontend-image-digest.txt').trim()
          if (!frontendDigest) {
            error('Frontend image push verification failed: digest file is empty.')
          }
          echo "Frontend image digest: ${frontendDigest}"
        }
      }
    }

    stage('Clone Deployment Repository') {
      steps {
        dir('deployment') {
          deleteDir()
          sh '''
            set -eu
            git clone ${DEPLOYMENT_REPO_URL} .
            git rev-parse --abbrev-ref HEAD
          '''
        }
      }
    }

    stage('Update') {
      steps {
        dir('deployment') {
          sh '''
            set -eu
            yq -i '.backend.image.tag = strenv(BUILD_NUMBER) | .frontend.image.tag = strenv(BUILD_NUMBER)' helm/netflix/values-dev.yaml
            grep -n 'tag:' helm/netflix/values-dev.yaml
          '''
        }
      }
    }

    stage('Git Add') {
      steps {
        dir('deployment') {
          sh '''
            set -eu
            git add helm/netflix/values-dev.yaml
          '''
        }
      }
    }

    stage('Git Commit') {
      steps {
        dir('deployment') {
          sh '''
            set -eu
            git config user.name "Jenkins"
            git config user.email "jenkins@local"
            git commit -m "Deploy Build ${BUILD_NUMBER}"
          '''
        }
      }
    }

    stage('Git Push') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'github-creds', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
          script {
            env.GIT_PASSWORD_ENCODED = java.net.URLEncoder.encode(env.GIT_PASSWORD, 'UTF-8')
          }
          dir('deployment') {
            sh '''
              set +x
              git remote set-url origin https://${GIT_USERNAME}:${GIT_PASSWORD_ENCODED}@github.com/bandi2-dev/netflix-deployment.git
              git push origin HEAD:$(git rev-parse --abbrev-ref HEAD)
            '''
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        dir('deployment') {
          sh '''
            set -eu
            helm upgrade --install ${RELEASE_NAME} helm/netflix -f helm/netflix/values-dev.yaml -n ${K8S_NAMESPACE} --create-namespace --wait --timeout 10m
          '''
        }
      }
    }

    stage('kubectl rollout status deployment/netflix-backend') {
      steps {
        sh '''
          set -eu

          rollback_release() {
            PREV_REVISION="$(helm history ${RELEASE_NAME} -n ${K8S_NAMESPACE} | awk 'NR>1 {rev[++count]=$1} END {if (count > 1) print rev[count-1]}')"
            if [ -n "${PREV_REVISION}" ]; then
              helm rollback ${RELEASE_NAME} "${PREV_REVISION}" -n ${K8S_NAMESPACE} --wait --timeout 10m
            else
              echo "No previous Helm revision available for rollback."
            fi
          }

          if ! kubectl rollout status deployment/netflix-backend -n ${K8S_NAMESPACE} --timeout=600s; then
            rollback_release
            exit 1
          fi
        '''
      }
    }

    stage('kubectl rollout status deployment/netflix-frontend') {
      steps {
        sh '''
          set -eu

          rollback_release() {
            PREV_REVISION="$(helm history ${RELEASE_NAME} -n ${K8S_NAMESPACE} | awk 'NR>1 {rev[++count]=$1} END {if (count > 1) print rev[count-1]}')"
            if [ -n "${PREV_REVISION}" ]; then
              helm rollback ${RELEASE_NAME} "${PREV_REVISION}" -n ${K8S_NAMESPACE} --wait --timeout 10m
            else
              echo "No previous Helm revision available for rollback."
            fi
          }

          if ! kubectl rollout status deployment/netflix-frontend -n ${K8S_NAMESPACE} --timeout=600s; then
            rollback_release
            exit 1
          fi
        '''
      }
    }

    stage('Verify Pods') {
      steps {
        sh '''
          set -eu
          kubectl get pods -n ${K8S_NAMESPACE} -o wide
        '''
      }
    }

    stage('Verify Services') {
      steps {
        sh '''
          set -eu
          kubectl get svc -n ${K8S_NAMESPACE}
        '''
      }
    }

    stage('Verify Gateway') {
      steps {
        sh '''
          set -eu
          if kubectl api-resources | awk '{print $1}' | grep -qx 'gateways'; then
            kubectl get gateway -n ${K8S_NAMESPACE}
          else
            echo "Gateway resource not available in this cluster."
          fi
        '''
      }
    }

    stage('Verify HTTPRoute') {
      steps {
        sh '''
          set -eu
          if kubectl api-resources | awk '{print $1}' | grep -qx 'httproutes'; then
            kubectl get httproute -n ${K8S_NAMESPACE}
          else
            echo "HTTPRoute resource not available in this cluster."
          fi
        '''
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'backend/target/*.jar,frontend/dist/**', allowEmptyArchive: true, fingerprint: true
      cleanWs(deleteDirs: true, disableDeferredWipeout: true)
    }
  }
}