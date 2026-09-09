pipeline {
    agent any

    tools {
        nodejs 'NodeJS26'
    }

    environment {
        SCANNER_HOME = tool 'sonar-scanner'
        DOCKER_IMAGE_API = "devops-api:${BUILD_NUMBER}"
        DOCKER_IMAGE_CLIENT = "devops-client:${BUILD_NUMBER}"
    }

    stages {
        // Stage 1: Git Checkout
        stage('Git Checkout') {
            steps {
                echo '=== Stage 1: Checking out source code ==='
                checkout scm
            }
        }

        // Stage 2: Build
        stage('Build') {
            steps {
                echo '=== Stage 2: Building Frontend and Backend ==='
                dir('client') {
                    echo 'Building Client Application...'
                    sh 'npm ci'
                    sh 'npm run build'
                }
                dir('api') {
                    echo 'Installing API Dependencies...'
                    sh 'npm install'
                }
            }
        }

        // Stage 3: Test
        stage('Test') {
            steps {
                echo '=== Stage 3: Running Automated Tests ==='
                dir('client') {
                    echo 'Running Client Tests...'
                    sh 'npm test'
                }
                dir('api') {
                    echo 'Running API Tests...'
                    sh 'npm test'
                }
            }
        }

        // Stage 4: Security & Quality Scans (GitLeaks, SonarQube, Trivy)
        stage('Security & Code Quality') {
            steps {
                echo '=== Stage 4: Security and Vulnerability Scanning ==='
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh 'gitleaks detect --source ./client --exit-code 0 || true'
                    sh 'gitleaks detect --source ./api --exit-code 0 || true'
                }
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    withSonarQubeEnv('sonar-server') {
                        sh '''$SCANNER_HOME/bin/sonar-scanner \
                            -Dsonar.projectName=3-Tier-DevOps-Project \
                            -Dsonar.projectKey=3-Tier-DevOps-Project \
                            -Dsonar.sources=api,client/src || true'''
                    }
                }
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    sh 'trivy fs --format table -o fs-report.html . || true'
                }
            }
        }

        // Stage 5: Docker Build
        stage('Docker Build') {
            steps {
                echo '=== Stage 5: Building Docker Images ==='
                sh 'docker build -t devops-api:latest -t ${DOCKER_IMAGE_API} ./api'
                sh 'docker build -t devops-client:latest -t ${DOCKER_IMAGE_CLIENT} ./client'
                sh 'docker build -t devops-nginx:latest ./nginx'
            }
        }

        // Stage 6: Deploy
        stage('Deploy') {
            steps {
                echo '=== Stage 6: Deploying Application with Docker Compose ==='
                sh 'docker compose down || true'
                sh 'docker compose up -d'
            }
        }

        // Stage 7: Health Check
        stage('Health Check') {
            steps {
                echo '=== Stage 7: Verifying Application Health ==='
                sleep time: 10, unit: 'SECONDS'
                script {
                    sh '''
                        echo "Verifying API health endpoint..."
                        for i in {1..10}; do
                            if curl -sf http://localhost:5000/health; then
                                echo "API is HEALTHY!"
                                exit 0
                            fi
                            echo "Waiting for API to become ready (attempt $i/10)..."
                            sleep 3
                        done
                        echo "API Health Check FAILED"
                        exit 1
                    '''
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline execution complete.'
        }
        success {
            echo 'Deployment and health check PASSED successfully!'
        }
        failure {
            echo 'Pipeline failed. Check build logs for details.'
        }
    }
}
