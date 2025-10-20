class Graph {
    constructor() {
        this.functions = [];
        this.colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#c0392b'];
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.padding = 40;
        this.plot_button_clicked = false;

        this.setupEventListeners();
        this.resizeCanvas();
    }

    parseFloat(str) {
        if (typeof str !== 'string')
            return Number(str);
        
        const parts = str.split('.');
        const part_int = Number(parts[0]);
        
        if (parts.length === 1)
            return part_int;
        
        const part_dec = Number('0.' + parts[1]);

        return part_int + (part_int >= 0 ? part_dec : -part_dec);
    }

    parseInt(x) {
        const n = this.parseFloat(x);
        return n - (n % 1);
    }

    abs(x) {
        return x < 0 ? -x : x;
    }

    floor(x) {
        const n = this.parseFloat(x);
        const int_part = this.parseInt(n);
        return n < 0 && int_part !== n ? int_part - 1 : int_part;
    }

    ceil(x) {
        const n = this.parseFloat(x);
        const int_part = this.parseInt(n);
        return n > 0 && int_part !== n ? int_part + 1 : int_part;
    }

    round(x) {
        const n = this.parseFloat(x);
        const int_part = this.parseInt(n);
        return this.abs(n - int_part) >= 0.5 ? (n > 0 ? int_part + 1 : int_part - 1) : int_part;
    }

    PI() {
        return 3.141592653589793;
    }

    isNotNanOrInf(x) {
        return x === x && x * 0 === 0;
    }
    
    calcStep(min, max) {
        const range = max - min;
        return range < 20 ? 1 : range < 100 ? 5 : 10;
    }

    xToPixel(x, xMin, xMax, width) { 
        return (x - xMin) / (xMax - xMin) * width;
    }
    
    yToPixel(y, yMin, yMax, height) { 
        return height - (y - yMin) / (yMax - yMin) * height;
    }

    setupEventListeners() {
        document.getElementById('addFunc').addEventListener('click', () => this.addFunc());
        document.getElementById('inputFunc').addEventListener('keypress', e => e.key === 'Enter' && this.addFunc());
        document.getElementById('plotGraphs').addEventListener('click', () => {
            this.plot_button_clicked = true;
            this.plotGraphs();
        });
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.plotGraphs();
        });
    }

    resizeCanvas() {
        const c = this.canvas;
        c.width = c.offsetWidth;
        c.height = c.offsetHeight;
    }

    addFunc() {
        const input = document.getElementById('inputFunc').value.trim();
        if (!input)
            return this.showError('Введите функцию');

        try {
            this.functions.push({
                expression: input,
                func: this.parseFunc(input),
                color: this.colors[this.functions.length % this.colors.length],
                enabled: true
            });

            this.updateUI();
            document.getElementById('inputFunc').value = '';
        } catch {
            this.showError('Введите функцию в правильном формате. Например, y = 2 * (x + 1) или y = x^2');
        }
    }

    removeFunc(index) {
        this.functions.splice(index, 1);
        this.updateUI();
        this.plotGraphs();
    }

    updateUI() {
        this.updateFunctionsList();
        this.updatePlotButton();
    }

    updatePlotButton() {
        document.getElementById('plotGraphs').disabled = this.functions.length === 0;
    }

    parseFunc(input) {
        const normalized = input.toLowerCase()
            .replace(/y\s*=\s*/, '')
            .replace(/\s+/g, '')
            .replace(/\^/g, '**')
            .replace(/[×÷]/g, m => ({'×': '*', '÷': '/'}[m]));

        if (!this.isValidExpr(normalized))
            throw new Error('Некорректное выражение');

        return x => {
            try {
                return this.evaluateExpr(normalized, x);
            } catch (error) {
                throw new Error(`Ошибка при x=${x}: ${error.message}`);
            }
        };
    }

    isValidExpr(expr) {
        const allow_char = /^[0-9x+\-*/().]+$/;
        if (!allow_char.test(expr.replace(/\*\*/g, '')))
            return false;

        if (expr.length > 1 && ['+', '-', '*', '/', '^'].includes(expr))
            return false;

        if (expr.startsWith('+'))
            return false;

        const checkPowerWithoutNumber = (i = 0) => {
            if (i >= expr.length - 1) 
                return true;

            const current = expr[i], next = expr[i + 1];
            if (current === '*' && next === '*' && (i === 0 || !/[0-9x)]/.test(expr[i - 1]))) 
                return false;

            return checkPowerWithoutNumber(i + 1);
        };
        
        if (!checkPowerWithoutNumber())
            return false;

        const bracket_balance = expr.split('').reduce((balance, char) => 
            balance + (char === '(' ? 1 : char === ')' ? -1 : 0),
        0);

        if (bracket_balance !== 0)
            return false;

        const checkDoubleOperators = (i = 0) => {
            if (i >= expr.length - 1)
                return true;

            const current = expr[i], next = expr[i + 1];
            
            if (['+', '-', '*', '/', '^'].includes(current) && ['+', '-', '*', '/', '^'].includes(next)) {
                if (current === '*' && next === '*')
                    return checkDoubleOperators(i + 2);

                if (current === '-' && next === '-') {
                    const isUnar = (i === 0) || ['+', '-', '*', '/', '^', '('].includes(expr[i - 1]);
                    if (isUnar)
                        return checkDoubleOperators(i + 1);
                }
                return false;
            }
            return checkDoubleOperators(i + 1);
        };
        
        if (!checkDoubleOperators())
            return false;

        const checkMissingOperator = (i = 0) => {
            if (i >= expr.length - 1)
                return true;

            const current = expr[i], next = expr[i + 1];
            const isEndFirstOperand = /[0-9x)]/.test(current);
            const isStartSecondOperand = /[0-9x(]/.test(next);

            return isEndFirstOperand && isStartSecondOperand && !(/[0-9]/.test(current) && /[0-9]/.test(next)) ?
                false
                :
                checkMissingOperator(i + 1);
        };
        
        return checkMissingOperator();
    }

    evaluateExpr(expr, x) {
        let pos = 0;

        const parseAddit = () => {
            let left = parseMultPow();
            
            const processOper = () => {
                if (pos >= expr.length || (expr[pos] !== '+' && expr[pos] !== '-'))
                    return left;

                const sign = expr[pos++];
                const right = parseMultPow();
                left = sign === '+' ? left + right : left - right;

                return processOper();
            };
            
            return processOper();
        };

        const parseMultPow = () => {
            let left = parseFactor();
            
            const processOper = () => {
                if (pos >= expr.length)
                    return left;

                if (expr[pos] === '*' && expr[pos + 1] === '*') {
                    pos += 2;
                    const right = parseMultPow();
                    left **= right;
                    return processOper();
                }
                
                if (expr[pos] !== '*' && expr[pos] !== '/')
                    return left;
                
                const op = expr[pos++];
                const right = parseFactor();
                
                if (op === '*') {
                    left *= right;
                } else {
                    if (right === 0)
                        throw new Error('Деление на ноль');
                    left /= right;
                }
                
                return processOper();
            };
            
            return processOper();
        };

        const parseFactor = () => {
            if (pos >= expr.length)
                throw new Error('Неожиданный конец выражения');

            if (expr[pos] === '-') {
                pos++;
                return -parseFactor();
            }

            if (expr[pos] === '(') {
                pos++;
                const result = parseAddit();
                if (expr[pos] !== ')')
                    throw new Error('Ожидалась закрывающая скобка');
                pos++;
                return result;
            }

            return parseNumVal();
        };

        const parseNumVal = () => {
            let start = pos;

            if (expr[pos] === 'x') {
                pos++;
                return x;
            }

            const readNumber = () => {
                if (pos >= expr.length || !/[0-9.]/.test(expr[pos]))
                    return;
                pos++;
                readNumber();
            };
            
            readNumber();

            const n_str = expr.substring(start, pos);
            if (n_str === '')
                throw new Error('Ожидалось число или переменная');

            const n = this.parseFloat(n_str);
            if (isNaN(n))
                throw new Error(`Некорректное число: ${n_str}`);

            return n;
        };

        const result = parseAddit();
        if (pos !== expr.length)
            throw new Error(`Некорректный символ: ${expr[pos]}`);
        return result;
    }

    calcFuncValues(func, xMin, xMax) {
        const points_count = 800;
        const step = (xMax - xMin) / points_count;
        const values = [];
        let lastValidPoint = null;
        
        for (let i = 0; i <= points_count; i++) {
            const x = xMin + i * step;

            try {
                const y = func(x);
                const valid = this.isNotNanOrInf(y);
                
                if (lastValidPoint && !valid) {
                    values.push({ ...lastValidPoint, segmentEnd: true });
                }
                
                values.push({ 
                    x, y, valid,
                    segmentStart: !lastValidPoint || (!lastValidPoint.valid && valid)
                });
                
                lastValidPoint = { x, y, valid };
            } catch {
                if (lastValidPoint) {
                    values.push({ ...lastValidPoint, segmentEnd: true });
                }

                values.push({ x, y: NaN, valid: false });
                lastValidPoint = null;
            }
        }

        return values;
    }

    plotGraphs() {
        const [xMin, xMax, yMin, yMax] = ['xMin', 'xMax', 'yMin', 'yMax'].map(id => 
            this.parseFloat(document.getElementById(id).value)
        );

        if (xMin >= xMax || yMin >= yMax) {
            return this.showError('Мин. значения осей должны быть меньше макс. значений осей');
        }

        this.clearCanvas();
        this.drawGridAxes(xMin, xMax, yMin, yMax);

        const enabledFunc = this.functions.filter(f => f.enabled);
        if (enabledFunc.length === 0) {
            this.displayPointsInfo([]);
            return;
        }

        const allPoints = [];
        
        enabledFunc.forEach((funcObj, index) => {
            const values = this.calcFuncValues(funcObj.func, xMin, xMax);
            this.drawFunc(values, funcObj.color, xMin, xMax, yMin, yMax);

            const zeroPoint = this.calcZeroPoint(funcObj.func);
            const points = this.findPoints(values, yMin, yMax);
            
            if (zeroPoint && zeroPoint.valid && 
                zeroPoint.x > xMin && zeroPoint.x < xMax && zeroPoint.y >= yMin && zeroPoint.y <= yMax) {
                points.length >= 2 ? points.splice(1, 0, zeroPoint) : points.push(zeroPoint);
            }
            
            allPoints.push({ function: funcObj.expression, points });
            this.highlightPoints(points, funcObj.color, xMin, xMax, yMin, yMax);
        });

        this.displayPointsInfo(allPoints);

        if (this.plot_button_clicked) {
            this.showSuccess('Графики построены');
            this.plot_button_clicked = false;
        }
    }

    calcZeroPoint(func) {
        try {
            const y = func(0);
            if (this.isNotNanOrInf(y)) {
                return {
                    x: 0,
                    y: this.round(y * 100) / 100,
                    valid: true
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    findPoints(points, yMin, yMax) {
        const validPoints = points.filter(p => p.valid && p.y >= yMin && p.y <= yMax);
        if (validPoints.length === 0)
            return [];

        const firstVisible = validPoints[0];
        const lastVisible = validPoints[validPoints.length - 1];
        
        const foundPoints = [
            { x: this.round(firstVisible.x * 100) / 100, y: this.round(firstVisible.y * 100) / 100 },
            { x: this.round(lastVisible.x * 100) / 100, y: this.round(lastVisible.y * 100) / 100 }
        ];

        const uniquePoints = foundPoints.reduce((unique, point) => {
            const isDuplicate = unique.some(p => 
                this.abs(p.x - point.x) < 0.01 && this.abs(p.y - point.y) < 0.01
            );
            return isDuplicate ? unique : [...unique, point];
        }, []);

        return uniquePoints.slice(0, 5);
    }

    highlightPoints(points, color, xMin, xMax, yMin, yMax) {
        const { width, height } = this.canvas;
        const graphWidth = width - this.padding * 2;
        const graphHeight = height - this.padding * 2;
        
        points.forEach(point => {
            const pixelX = this.padding + this.xToPixel(point.x, xMin, xMax, graphWidth);
            const pixelY = this.padding + this.yToPixel(point.y, yMin, yMax, graphHeight);
            
            if (pixelX <= width - this.padding && pixelY <= height - this.padding) {
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(pixelX, pixelY, 6, 0, 2 * this.PI());
                this.ctx.fill();
                
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#2c3e50';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`(${point.x},${point.y})`, pixelX, pixelY - 15);
            }
        });
    }

    drawGridAxes(xMin, xMax, yMin, yMax) {
        const { width, height } = this.canvas;
        const graphWidth = width - this.padding * 2;
        const graphHeight = height - this.padding * 2;
        
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 1;
        
        const drawGridLines = (values, isHorizontal) => {
            values.forEach(value => {
                const pos = isHorizontal ? 
                    this.padding + this.xToPixel(value, xMin, xMax, graphWidth)
                    :
                    this.padding + this.yToPixel(value, yMin, yMax, graphHeight);
                
                this.ctx.beginPath();
                if (isHorizontal) {
                    this.ctx.moveTo(pos, this.padding);
                    this.ctx.lineTo(pos, height - this.padding);
                } else {
                    this.ctx.moveTo(this.padding, pos);
                    this.ctx.lineTo(width - this.padding, pos);
                }
                this.ctx.stroke();
            });
        };

        drawGridLines(this.generateGridValues(xMin, xMax, this.calcStep(xMin, xMax)), true);
        drawGridLines(this.generateGridValues(yMin, yMax, this.calcStep(yMin, yMax)), false);

        this.ctx.strokeStyle = '#2c3e50';
        this.ctx.lineWidth = 2;
        
        const drawAxisLine = (value, isHorizontal) => {
            const pos = isHorizontal ? 
                this.padding + this.xToPixel(value, xMin, xMax, graphWidth)
                : 
                this.padding + this.yToPixel(value, yMin, yMax, graphHeight);
            
            if (pos >= this.padding && pos <= (isHorizontal ? width - this.padding : height - this.padding)) {
                this.ctx.beginPath();
                if (isHorizontal) {
                    this.ctx.moveTo(pos, this.padding);
                    this.ctx.lineTo(pos, height - this.padding);
                } else {
                    this.ctx.moveTo(this.padding, pos);
                    this.ctx.lineTo(width - this.padding, pos);
                }
                this.ctx.stroke();
            }
        };

        drawAxisLine(0, true);
        drawAxisLine(0, false);
    }

    generateGridValues(min, max, step) {
        const start = this.ceil(min / step) * step;
        const count = this.floor((max - start) / step) + 1;
        const values = [];
        
        for (let i = 0; i < count; i++) {
            values.push(start + i * step);
        }
        
        return values;
    }

    drawFunc(points, color, xMin, xMax, yMin, yMax) {
        const { width, height } = this.canvas;
        const graphWidth = width - this.padding * 2;
        const graphHeight = height - this.padding * 2;
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        
        let currentSegment = [];
        
        points.forEach((point, i) => {
            if (point.valid && point.y >= yMin && point.y <= yMax) {
                currentSegment.push({
                    x: this.padding + this.xToPixel(point.x, xMin, xMax, graphWidth),
                    y: this.padding + this.yToPixel(point.y, yMin, yMax, graphHeight),
                    originalY: point.y
                });
            }
            
            if (!point.valid || point.y < yMin || point.y > yMax || point.segmentEnd || i === points.length - 1) {
                this.drawSegment(currentSegment, yMin, yMax);
                currentSegment = [];
            }
        });
    }

    drawSegment(segment, yMin, yMax) {
        if (segment.length < 2)
            return;

        this.ctx.beginPath();
        
        let lastValidIndex = -1;
        
        segment.forEach((point, i) => {
            if (point.originalY >= yMin && point.originalY <= yMax) {
                if (lastValidIndex === -1) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
                lastValidIndex = i;
            } else if (lastValidIndex !== -1) {
                lastValidIndex = -1;
            }
        });
        
        this.ctx.stroke();
    }
    
    updateFunctionsList() {
        const list = document.getElementById('functionsList');
        
        const functionsHTML = this.functions.length === 0 ?
            '<div style="text-align: center; color: #6c757d; padding: 1rem;">Нет добавленных функций</div>'
            : 
            this.functions.map((func, index) => `
                <div class="function-item">
                    <div class="function-color" style="background-color: ${func.color}"></div>
                    <div class="function-expression">${func.expression}</div>
                    <input type="checkbox" class="function-toggle" ${func.enabled ? 'checked' : ''}>
                    <button class="delete-function" title="Удалить функцию">×</button>
                </div>
            `).join('');

        list.innerHTML = `<h3>Добавленные функции:</h3>${functionsHTML}`;

        this.functions.forEach((func, index) => {
            const item = list.querySelectorAll('.function-item')[index];
            const toggle = item.querySelector('.function-toggle');
            const deleteBtn = item.querySelector('.delete-function');
            
            toggle.addEventListener('change', (e) => {
                this.functions[index].enabled = e.target.checked;
                this.plotGraphs();
            });
            deleteBtn.addEventListener('click', () => this.removeFunc(index));
        });
    }

    displayPointsInfo(pointsData) {
        const content = pointsData.filter(data => data.points.length).map(data => `
            <div style="margin-bottom: 1rem;">
                <strong>${data.function}:</strong>
                <div style="margin-left: 1rem; color: #666;">
                    ${data.points.map(p => `(${p.x}, ${p.y})`).join(', ')}
                </div>
            </div>
        `).join('') || '<div>Значительные точки не найдены</div>';
        
        document.getElementById('pointsInfo').innerHTML = `<h3>Найденные точки:</h3>${content}`;
    }

    clearCanvas() { 
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); 
    }

    showMessage(message, type) {
        const div = document.getElementById(type);
        const otherType = type === 'errorMessage' ? 'successMessage' : 'errorMessage';
        
        div.textContent = message;
        div.style.display = 'block';
        document.getElementById(otherType).style.display = 'none';
        
        setTimeout(() => div.style.display = 'none', type === 'errorMessage' ? 5000 : 3000);
    }

    showError(message) { 
        this.showMessage(message, 'errorMessage'); 
    }
    
    showSuccess(message) { 
        this.showMessage(message, 'successMessage'); 
    }
}

document.addEventListener('DOMContentLoaded', () => new Graph());