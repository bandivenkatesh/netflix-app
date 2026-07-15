pipeline {
  agent {
    label 'built-in'
  }

  options {
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
    skipDefaultCheckout(true)
    timestamps()
    ansiColor('xterm')
  }

  parameters {
    string(
      name: 'IMAGE_TAG',
      defaultValue: '',
      description: 'Custom image tag for Docker images. Leave empty to use Jenkins BUILD_NUMBER.'
    )
    choice(
      name: 'DEPLOY_ENV',
      choices: ['dev', 'staging', 'prod'],
      description: 'Target deployment environment. Selects the corresponding Helm values file and Kubernetes namespace.'
    )
    booleanParam(
      name: 'SKIP_SONARQUBE',
      defaultValue: false,
      description: 'If checked, skips both SonarQube static analysis and Quality Gate enforcement stages.'
    )
    booleanParam(
      name: 'SKIP_BACKEND_BUILD',
      defaultValue: false,
      description: 'If checked, skips the Maven backend build stage.'
    )
    booleanParam(
      name: 'SKIP_FRONTEND_BUILD',
      defaultValue: false,
      description: 'If checked, skips the npm frontend build stage.'
    )
    booleanParam(
      name: 'SKIP_DOCKER_BUILD',
      defaultValue: false,
      description: 'If checked, skips Kaniko Docker image builds for both backend and frontend.'
    )
    booleanParam(
      name: 'SKIP_DEPLOY',
      defaultValue: false,
      description: 'If checked, skips Helm deployment, rollout checks, and all verification stages.'
    )
    booleanParam(
      name: 'ROLLBACK_ON_FAILURE',
      defaultValue: true,
      description: 'If checked, automatically rolls back to the previous Helm revision if a Kubernetes rollout fails.'
    )
    booleanParam(
      name: 'ENABLE_VERBOSE_LOGGING',
      defaultValue: false,
      description: 'If checked, enables set -x in shell blocks for detailed command tracing. Useful for debugging.'
    )
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
    RESOLVED_IMAGE_TAG         = "${params.IMAGE_TAG ? params.IMAGE_TAG : env.BUILD_NUMBER}"
    HELM_VALUES_FILE           = "helm/netflix/values-${params.DEPLOY_ENV}.yaml"
  }

  stages {

    stage('Environment Info') {
      steps {
        echo '================================================================================'
        echo '[STAGE] Environment Info - Verifying toolchain versions on the Jenkins agent.'
        echo "[INFO] Build Number       : ${env.BUILD_NUMBER}"
        echo "[INFO] Deploy Environment  : ${params.DEPLOY_ENV}"
        echo "[INFO] Image Tag          : ${env.RESOLVED_IMAGE_TAG}"
        echo "[INFO] Skip SonarQube     : ${params.SKIP_SONARQUBE}"
        echo "[INFO] Skip Backend Build : ${params.SKIP_BACKEND_BUILD}"
        echo "[INFO] Skip Frontend Build: ${params.SKIP_FRONTEND_BUILD}"
        echo "[INFO] Skip Docker Build  : ${params.SKIP_DOCKER_BUILD}"
        echo "[INFO] Skip Deploy        : ${params.SKIP_DEPLOY}"
        echo "[INFO] Rollback on Fail   : ${params.ROLLBACK_ON_FAILURE}"
        echo "[INFO] Verbose Logging    : ${params.ENABLE_VERBOSE_LOGGING}"
        echo '================================================================================'
        sh '''
          set +e
          echo "[CHECK] Java version      : $(java -version 2>&1 | head -1)"
          echo "[CHECK] Maven version     : $(mvn -version 2>&1 | head -1)"
          echo "[CHECK] Node version      : $(node --version 2>&1)"
          echo "[CHECK] npm version       : $(npm --version 2>&1)"
          echo "[CHECK] kubectl version   : $(kubectl version --client 2>&1 | head -1)"
          echo "[CHECK] Helm version      : $(helm version 2>&1 | head -1)"
          echo "[CHECK] gcloud version    : $(gcloud version 2>&1 | head -1)"
          echo "[CHECK] Git version       : $(git --version 2>&1)"
          echo "[CHECK] yq version        : $(yq --version 2>&1 | head -1)"
        '''
        echo "[SUCCESS] Environment Info - All toolchain versions retrieved successfully."
      }
    }

    stage('Checkout Application Repository') {
      steps {
        echo "[STAGE] Checkout Application Repository - Fetching source code from ${env.APP_REPO_URL}."
        deleteDir()
        checkout scm
        echo "[INFO] Source code checked out. Stashing backend, frontend, and Jenkinsfile."
        stash name: 'app-source', includes: 'backend/**,frontend/**,Jenkinsfile', excludes: '**/target/**,**/node_modules/**,**/dist/**', useDefaultExcludes: false
        echo "[SUCCESS] Application source stashed as 'app-source' for downstream stages."
      }
    }

    stage('Backend Build') {
      when {
        expression { !params.SKIP_BACKEND_BUILD }
      }
      steps {
        echo "[STAGE] Backend Build - Compiling Spring Boot backend with Maven (tests skipped)."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
          echo "[INFO] Starting Maven build: mvn -f backend/pom.xml -B clean package -DskipTests=true"
          mvn -f backend/pom.xml -B clean package -DskipTests=true
          echo "[INFO] Backend JAR artifact(s) produced:"
          ls -lh backend/target/*.jar || { echo "[ERROR] No JAR found in backend/target/ - build may have failed."; exit 1; }
        '''
        echo "[SUCCESS] Backend Build - Maven build completed, JAR artifact is ready."
      }
    }

    stage('Frontend Build') {
      when {
        expression { !params.SKIP_FRONTEND_BUILD }
      }
      steps {
        echo "[STAGE] Frontend Build - Installing dependencies and building the frontend with npm."
        dir('frontend') {
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
            echo "[INFO] Installing npm dependencies (npm ci)..."
            npm ci
            echo "[INFO] Running production build (npm run build)..."
            npm run build
            echo "[INFO] Frontend dist artifacts:"
            ls -lh dist/ || { echo "[ERROR] No dist/ directory found - frontend build may have failed."; exit 1; }
          '''
        }
        echo "[SUCCESS] Frontend Build - npm build completed, dist/ artifacts are ready."
      }
    }

    stage('SonarQube Analysis') {
      when {
        expression { !params.SKIP_SONARQUBE }
      }
      steps {
        echo "[STAGE] SonarQube Analysis - Running static code analysis for both backend and frontend."
        withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi

            echo "[INFO] Analyzing backend with SonarQube (projectKey: ${SONAR_BACKEND_PROJECT_KEY})..."
            mvn -f backend/pom.xml -B sonar:sonar \
              -DskipTests=true \
              -Dsonar.projectKey=${SONAR_BACKEND_PROJECT_KEY} \
              -Dsonar.projectName="Netflix Clone Backend Dev" \
              -Dsonar.projectVersion=${BUILD_NUMBER} \
              -Dsonar.host.url=${SONAR_HOST_URL} \
              -Dsonar.token=${SONAR_TOKEN}
            echo "[SUCCESS] Backend SonarQube analysis submitted."

            echo "[INFO] Generating minimal POM for frontend SonarQube analysis..."
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

            echo "[INFO] Analyzing frontend with SonarQube (projectKey: ${SONAR_FRONTEND_PROJECT_KEY})..."
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
            echo "[SUCCESS] Frontend SonarQube analysis submitted."
          '''
        }
        echo "[SUCCESS] SonarQube Analysis - Both backend and frontend analyses submitted."
      }
    }

    stage('Quality Gate') {
      when {
        expression { !params.SKIP_SONARQUBE }
      }
      steps {
        echo "[STAGE] Quality Gate - Polling SonarQube for compute-engine task completion and quality gate status."
        withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
          sh '''
            set +e
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi

            fetch_url() {
              if command -v curl >/dev/null 2>&1; then
                curl -sS -u "${SONAR_TOKEN}:" "$1"
              elif command -v wget >/dev/null 2>&1; then
                AUTH_HEADER="$(printf "%s:" "${SONAR_TOKEN}" | base64 | tr -d '\\n')"
                wget -qO- --header="Authorization: Basic ${AUTH_HEADER}" "$1"
              else
                echo "[ERROR] Neither curl nor wget is available for SonarQube API checks."
                exit 1
              fi
            }

            check_quality_gate() {
              REPORT_FILE="$1"
              COMPONENT="$2"
              ALLOW_MISSING="$3"

              echo "[INFO] Checking quality gate for ${COMPONENT} (report: ${REPORT_FILE}, allow_missing: ${ALLOW_MISSING})."

              if [ ! -f "${REPORT_FILE}" ]; then
                if [ "${ALLOW_MISSING}" = "true" ]; then
                  echo "[WARN] Missing Sonar report-task file for ${COMPONENT} (${REPORT_FILE}). Skipping check."
                  return 0
                else
                  echo "[ERROR] Missing Sonar report-task file for ${COMPONENT}: ${REPORT_FILE}"
                  exit 1
                fi
              fi

              CE_TASK_URL="$(grep '^ceTaskUrl=' "${REPORT_FILE}" | cut -d= -f2-)"
              if [ -z "${CE_TASK_URL}" ]; then
                echo "[ERROR] Could not extract ceTaskUrl from ${REPORT_FILE} for ${COMPONENT}."
                exit 1
              fi
              echo "[INFO] Compute-engine task URL for ${COMPONENT}: ${CE_TASK_URL}"

              ANALYSIS_ID=""
              ATTEMPT=0
              MAX_ATTEMPTS=60

              echo "[INFO] Polling SonarQube compute-engine task for ${COMPONENT} (max ${MAX_ATTEMPTS} attempts, 10s interval)..."
              while [ "${ATTEMPT}" -lt "${MAX_ATTEMPTS}" ]; do
                RESPONSE="$(fetch_url "${CE_TASK_URL}")"
                TASK_STATUS="$(echo "${RESPONSE}" | sed -n 's/.*"status":"\\([^"]*\\)".*/\\1/p' | head -n 1)"
                ANALYSIS_ID="$(echo "${RESPONSE}" | sed -n 's/.*"analysisId":"\\([^"]*\\)".*/\\1/p' | head -n 1)"

                echo "[INFO] Attempt ${ATTEMPT}/${MAX_ATTEMPTS} - Task status: ${TASK_STATUS}, Analysis ID: ${ANALYSIS_ID:-N/A}"

                if [ "${TASK_STATUS}" = "SUCCESS" ] && [ -n "${ANALYSIS_ID}" ]; then
                  break
                fi

                if [ "${TASK_STATUS}" = "FAILED" ] || [ "${TASK_STATUS}" = "CANCELED" ]; then
                  echo "[ERROR] SonarQube compute task failed for ${COMPONENT} with status: ${TASK_STATUS}"
                  exit 1
                fi

                ATTEMPT=$((ATTEMPT + 1))
                sleep 10
              done

              if [ -z "${ANALYSIS_ID}" ]; then
                echo "[ERROR] Timed out waiting for SonarQube analysis completion for ${COMPONENT} after ${MAX_ATTEMPTS} attempts."
                exit 1
              fi

              echo "[INFO] Fetching quality gate status for ${COMPONENT} (analysisId: ${ANALYSIS_ID})..."
              QG_RESPONSE="$(fetch_url "${SONAR_HOST_URL}/api/qualitygates/project_status?analysisId=${ANALYSIS_ID}")"
              QG_STATUS="$(echo "${QG_RESPONSE}" | sed -n 's/.*"status":"\\([^"]*\\)".*/\\1/p' | head -n 1)"

              echo "[INFO] Quality gate result for ${COMPONENT}: ${QG_STATUS}"

              if [ "${QG_STATUS}" != "OK" ]; then
                echo "[ERROR] Quality Gate FAILED for ${COMPONENT}: ${QG_STATUS}"
                exit 1
              fi

              echo "[SUCCESS] Quality Gate PASSED for ${COMPONENT}: ${QG_STATUS}"
            }

            echo "[INFO] --- Backend Quality Gate (STRICT: must exist and pass) ---"
            check_quality_gate "backend/target/sonar/report-task.txt" "backend" "false"

            echo "[INFO] --- Frontend Quality Gate (FLEXIBLE: warn if missing) ---"
            check_quality_gate "frontend/.scannerwork/report-task.txt" "frontend" "true"
          '''
        }
        echo "[SUCCESS] Quality Gate - All quality gate checks completed."
      }
    }

    stage('Authenticate to Google Cloud') {
      when {
        expression { !params.SKIP_DOCKER_BUILD || !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Authenticate to Google Cloud - Activating service account and fetching GKE cluster credentials."
        withCredentials([file(credentialsId: 'gcp-service-account', variable: 'GCP_SA_KEY')]) {
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
            echo "[INFO] Activating GCP service account..."
            gcloud auth activate-service-account --key-file="${GCP_SA_KEY}"
            echo "[INFO] Setting GCP project: ${GCP_PROJECT}"
            gcloud config set project "${GCP_PROJECT}"
            echo "[INFO] Setting compute region: ${GCP_REGION}"
            gcloud config set compute/region "${GCP_REGION}"
            echo "[INFO] Fetching GKE cluster credentials: ${GKE_CLUSTER}"
            gcloud container clusters get-credentials "${GKE_CLUSTER}" --region "${GCP_REGION}" --project "${GCP_PROJECT}"
            echo "[INFO] Current kubectl context: $(kubectl config current-context)"
          '''
        }
        echo "[SUCCESS] Google Cloud authentication complete, kubectl context configured."
      }
    }

    stage('Build & Push Backend Image') {
      when {
        expression { !params.SKIP_DOCKER_BUILD }
      }
      steps {
        sh """
            gcloud builds submit backend \
              --tag us-central1-docker.pkg.dev/${GCP_PROJECT}/netflix-dev/netflix-backend:${BUILD_NUMBER}
        """
      }
    }

    stage('Build & Push Frontend Image') {
      when {
        expression { !params.SKIP_DOCKER_BUILD }
      }
      steps {
        sh """
            gcloud builds submit frontend \
              --tag us-central1-docker.pkg.dev/${GCP_PROJECT}/netflix-dev/netflix-frontend:${BUILD_NUMBER}
        """
      }
    }

    stage('Clone Deployment Repository') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Clone Deployment Repository - Fetching Helm chart configs from ${env.DEPLOYMENT_REPO_URL}."
        dir('deployment') {
          deleteDir()
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
            echo "[INFO] Cloning deployment repository..."
            git clone ${DEPLOYMENT_REPO_URL} .
            echo "[INFO] Current branch: $(git rev-parse --abbrev-ref HEAD)"
          '''
        }
        echo "[SUCCESS] Deployment repository cloned successfully."
      }
    }

    stage('Update Helm Values') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Update Helm Values - Setting image tags to ${env.RESOLVED_IMAGE_TAG} in ${env.HELM_VALUES_FILE}."
        dir('deployment') {
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
            echo "[INFO] Updating backend and frontend image tags to '${RESOLVED_IMAGE_TAG}' in ${HELM_VALUES_FILE}..."
            BUILD_NUMBER="${RESOLVED_IMAGE_TAG}" yq -i '.backend.image.tag = strenv(BUILD_NUMBER) | .frontend.image.tag = strenv(BUILD_NUMBER)' "${HELM_VALUES_FILE}"
            echo "[INFO] Updated image tag values:"
            grep -n 'tag:' "${HELM_VALUES_FILE}"
          '''
        }
        echo "[SUCCESS] Helm values updated with new image tag."
      }
    }

    stage('Git Commit') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Git Commit - Staging and committing Helm values changes to deployment repository."
        dir('deployment') {
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
            git config user.name "Jenkins"
            git config user.email "jenkins@local"
            echo "[INFO] Staging ${HELM_VALUES_FILE}..."
            git add "${HELM_VALUES_FILE}"
            echo "[INFO] Checking for staged changes..."
            if git diff --cached --quiet; then
              echo "[WARN] No changes detected in ${HELM_VALUES_FILE} - nothing to commit."
            else
              echo "[INFO] Committing changes..."
              git commit -m "Deploy Build ${BUILD_NUMBER} to ${DEPLOY_ENV} (image tag: ${RESOLVED_IMAGE_TAG})"
              echo "[SUCCESS] Changes committed."
            fi
          '''
        }
      }
    }

    stage('Git Push') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Git Push - Pushing deployment commit to remote repository."
        withCredentials([usernamePassword(credentialsId: 'github-creds', usernameVariable: 'GIT_USERNAME', passwordVariable: 'GIT_PASSWORD')]) {
          script {
            env.GIT_PASSWORD_ENCODED = java.net.URLEncoder.encode(env.GIT_PASSWORD, 'UTF-8')
          }
          dir('deployment') {
            sh '''
              set +x
              echo "[INFO] Setting remote URL with credentials..."
              git remote set-url origin https://${GIT_USERNAME}:${GIT_PASSWORD_ENCODED}@github.com/bandi2-dev/netflix-deployment.git
              echo "[INFO] Pushing to branch: $(git rev-parse --abbrev-ref HEAD)..."
              git push origin HEAD:$(git rev-parse --abbrev-ref HEAD)
              echo "[SUCCESS] Deployment changes pushed to remote."
            '''
          }
        }
      }
    }

    stage('Helm Deploy') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Helm Deploy - Running helm upgrade --install for release '${env.RELEASE_NAME}' in namespace '${env.K8S_NAMESPACE}'."
        dir('deployment') {
          sh '''
            set -eu
            if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
            echo "[INFO] Executing: helm upgrade --install ${RELEASE_NAME} helm/netflix -f ${HELM_VALUES_FILE} -n ${K8S_NAMESPACE} --create-namespace --wait --timeout 10m"
            helm upgrade --install ${RELEASE_NAME} helm/netflix -f "${HELM_VALUES_FILE}" -n ${K8S_NAMESPACE} --create-namespace --wait --timeout 10m
            echo "[SUCCESS] Helm release '${RELEASE_NAME}' deployed/updated in namespace '${K8S_NAMESPACE}'."
          '''
        }
      }
    }

    stage('Verify Backend Rollout') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Verify Backend Rollout - Checking kubectl rollout status for deployment/netflix-backend."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi

          rollback_release() {
            echo "[WARN] Backend rollout failed. Initiating Helm rollback..."
            PREV_REVISION="$(helm history ${RELEASE_NAME} -n ${K8S_NAMESPACE} | awk 'NR>1 {rev[++count]=$1} END {if (count > 1) print rev[count-1]}')"
            if [ -n "${PREV_REVISION}" ]; then
              echo "[INFO] Rolling back to Helm revision ${PREV_REVISION}..."
              helm rollback ${RELEASE_NAME} "${PREV_REVISION}" -n ${K8S_NAMESPACE} --wait --timeout 10m
              echo "[INFO] Helm rollback to revision ${PREV_REVISION} completed."
            else
              echo "[WARN] No previous Helm revision available for rollback."
            fi
          }

          echo "[INFO] Waiting for backend deployment rollout (timeout: 600s)..."
          if ! kubectl rollout status deployment/netflix-backend -n ${K8S_NAMESPACE} --timeout=600s; then
            if [ "${ROLLBACK_ON_FAILURE}" = "true" ]; then
              rollback_release
            else
              echo "[WARN] ROLLBACK_ON_FAILURE is disabled - skipping automatic rollback."
            fi
            echo "[ERROR] Backend rollout did not complete successfully."
            exit 1
          fi
          echo "[SUCCESS] Backend deployment rollout completed successfully."
        '''
      }
    }

    stage('Verify Frontend Rollout') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Verify Frontend Rollout - Checking kubectl rollout status for deployment/netflix-frontend."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi

          rollback_release() {
            echo "[WARN] Frontend rollout failed. Initiating Helm rollback..."
            PREV_REVISION="$(helm history ${RELEASE_NAME} -n ${K8S_NAMESPACE} | awk 'NR>1 {rev[++count]=$1} END {if (count > 1) print rev[count-1]}')"
            if [ -n "${PREV_REVISION}" ]; then
              echo "[INFO] Rolling back to Helm revision ${PREV_REVISION}..."
              helm rollback ${RELEASE_NAME} "${PREV_REVISION}" -n ${K8S_NAMESPACE} --wait --timeout 10m
              echo "[INFO] Helm rollback to revision ${PREV_REVISION} completed."
            else
              echo "[WARN] No previous Helm revision available for rollback."
            fi
          }

          echo "[INFO] Waiting for frontend deployment rollout (timeout: 600s)..."
          if ! kubectl rollout status deployment/netflix-frontend -n ${K8S_NAMESPACE} --timeout=600s; then
            if [ "${ROLLBACK_ON_FAILURE}" = "true" ]; then
              rollback_release
            else
              echo "[WARN] ROLLBACK_ON_FAILURE is disabled - skipping automatic rollback."
            fi
            echo "[ERROR] Frontend rollout did not complete successfully."
            exit 1
          fi
          echo "[SUCCESS] Frontend deployment rollout completed successfully."
        '''
      }
    }

    stage('Verify Pods') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Verify Pods - Listing all pods in namespace '${env.K8S_NAMESPACE}'."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
          echo "[INFO] Pods in namespace ${K8S_NAMESPACE}:"
          kubectl get pods -n ${K8S_NAMESPACE} -o wide
          echo "[SUCCESS] Pod verification complete."
        '''
      }
    }

    stage('Verify Services') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Verify Services - Listing all services in namespace '${env.K8S_NAMESPACE}'."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
          echo "[INFO] Services in namespace ${K8S_NAMESPACE}:"
          kubectl get svc -n ${K8S_NAMESPACE}
          echo "[SUCCESS] Service verification complete."
        '''
      }
    }

    stage('Verify Gateway') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Verify Gateway - Checking for Gateway CRD resources in namespace '${env.K8S_NAMESPACE}'."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
          if kubectl api-resources | awk '{print $1}' | grep -qx 'gateways'; then
            echo "[INFO] Gateway resources in namespace ${K8S_NAMESPACE}:"
            kubectl get gateway -n ${K8S_NAMESPACE}
            echo "[SUCCESS] Gateway verification complete."
          else
            echo "[INFO] Gateway CRD not available in this cluster - skipping."
          fi
        '''
      }
    }

    stage('Verify HTTPRoute') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        echo "[STAGE] Verify HTTPRoute - Checking for HTTPRoute CRD resources in namespace '${env.K8S_NAMESPACE}'."
        sh '''
          set -eu
          if [ "${ENABLE_VERBOSE_LOGGING}" = "true" ]; then set -x; fi
          if kubectl api-resources | awk '{print $1}' | grep -qx 'httproutes'; then
            echo "[INFO] HTTPRoute resources in namespace ${K8S_NAMESPACE}:"
            kubectl get httproute -n ${K8S_NAMESPACE}
            echo "[SUCCESS] HTTPRoute verification complete."
          else
            echo "[INFO] HTTPRoute CRD not available in this cluster - skipping."
          fi
        '''
      }
    }

  }

  post {
    always {
      echo '================================================================================'
      echo "[POST] Pipeline finished with result: ${currentBuild.currentResult}"
      echo "[POST] Archiving build artifacts (JAR, dist/)..."
      archiveArtifacts artifacts: 'backend/target/*.jar,frontend/dist/**', allowEmptyArchive: true, fingerprint: true
      echo "[POST] Cleaning workspace..."
      cleanWs(deleteDirs: true, disableDeferredWipeout: true)
      echo "[POST] Workspace cleanup complete."
      echo "[POST] Final build result: ${currentBuild.currentResult}"
      echo '================================================================================'
    }
    success {
      echo "[POST] BUILD SUCCESS - All stages completed. Image tag: ${env.RESOLVED_IMAGE_TAG}, Environment: ${params.DEPLOY_ENV}"
    }
    failure {
      echo "[POST] BUILD FAILURE - One or more stages failed. Review the console output above for details."
    }
    unstable {
      echo "[POST] BUILD UNSTABLE - Build completed with warnings. Check SonarQube quality gate or test results."
    }
    aborted {
      echo "[POST] BUILD ABORTED - Pipeline was manually aborted or timed out."
    }
  }
}