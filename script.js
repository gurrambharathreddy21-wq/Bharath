// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// DOM elements
const uploadSection = document.getElementById('uploadSection');
const assessmentSection = document.getElementById('assessmentSection');
const dashboardSection = document.getElementById('dashboardSection');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const contentDisplay = document.getElementById('contentDisplay');
const questionContainer = document.getElementById('questionContainer');
const submitBtn = document.getElementById('submitBtn');
const results = document.getElementById('results');
const progressChartCanvas = document.getElementById('progressChart');

// Navigation
document.getElementById('uploadBtn').addEventListener('click', () => showSection(uploadSection));
document.getElementById('assessmentBtn').addEventListener('click', () => showSection(assessmentSection));
document.getElementById('dashboardBtn').addEventListener('click', () => showSection(dashboardSection));

function showSection(section) {
    [uploadSection, assessmentSection, dashboardSection].forEach(s => s.style.display = 'none');
    section.style.display = 'block';
}

// File processing
let currentContent = '';

processBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return alert('Please select a file.');

    if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
            currentContent = e.target.result;
            contentDisplay.textContent = currentContent;
            generateAssessment(currentContent);
        };
        reader.readAsText(file);
    } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            text += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        currentContent = text;
        contentDisplay.textContent = text;
        generateAssessment(text);
    } else {
        alert('Unsupported file type.');
    }
});

// Assessment generation
let currentQuestions = [];

function generateAssessment(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    currentQuestions = [];
    for (let i = 0; i < Math.min(5, sentences.length); i++) {
        const sentence = sentences[i].trim();
        const words = sentence.split(' ');
        if (words.length < 5) continue;
        const correctAnswer = words[Math.floor(Math.random() * words.length)];
        const options = [correctAnswer];
        // Generate wrong options (simple: random words or variations)
        while (options.length < 4) {
            const wrong = words[Math.floor(Math.random() * words.length)].replace(/.$/, 'x'); // simple variation
            if (!options.includes(wrong)) options.push(wrong);
        }
        options.sort(() => Math.random() - 0.5);
        currentQuestions.push({
            question: `What word is in the sentence: "${sentence}"?`,
            options,
            correct: correctAnswer
        });
    }
    displayAssessment();
    showSection(assessmentSection);
}

function displayAssessment() {
    questionContainer.innerHTML = '';
    currentQuestions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question';
        div.innerHTML = `<p>${q.question}</p><div class="options">${q.options.map(opt => `<label><input type="radio" name="q${index}" value="${opt}"> ${opt}</label>`).join('')}</div>`;
        questionContainer.appendChild(div);
    });
}

// Submit assessment
submitBtn.addEventListener('click', () => {
    const answers = [];
    let score = 0;
    currentQuestions.forEach((q, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        if (selected) {
            answers.push(selected.value);
            if (selected.value === q.correct) score++;
        } else {
            answers.push(null);
        }
    });
    const percentage = (score / currentQuestions.length) * 100;
    results.textContent = `Score: ${score}/${currentQuestions.length} (${percentage.toFixed(2)}%)`;

    // Store in localStorage
    const userData = JSON.parse(localStorage.getItem('userData') || '{"assessments":[]}');
    userData.assessments.push({
        date: new Date().toISOString(),
        score: percentage,
        questions: currentQuestions,
        answers
    });
    localStorage.setItem('userData', JSON.stringify(userData));

    // Generate recommendations
    generateRecommendations(userData);
});

// Dashboard
function loadDashboard() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{"assessments":[]}');
    const assessments = userData.assessments;

    // Chart
    const ctx = progressChartCanvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: assessments.map(a => new Date(a.date).toLocaleDateString()),
            datasets: [{
                label: 'Score (%)',
                data: assessments.map(a => a.score),
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    generateRecommendations(userData);
}

function generateRecommendations(userData) {
    const recommendationsDiv = document.getElementById('recommendations');
    recommendationsDiv.innerHTML = '<h3>Personalized Recommendations</h3>';

    // Simple: Find common wrong topics (but since no topics, list sentences with wrong answers)
    const wrongs = [];
    userData.assessments.forEach(ass => {
        ass.questions.forEach((q, i) => {
            if (ass.answers[i] !== q.correct) {
                wrongs.push(q.question);
            }
        });
    });

    if (wrongs.length > 0) {
        recommendationsDiv.innerHTML += '<p>Review the following areas:</p><ul>' + wrongs.slice(0,5).map(w => `<li>${w}</li>`).join('') + '</ul>';
    } else {
        recommendationsDiv.innerHTML += '<p>Great job! Keep up the good work.</p>';
    }
}

// Initial load
showSection(uploadSection);
loadDashboard(); // Load chart on page load
