import Priority from "../enums/Priority.js";
import ITodo from "../interfaces/ITodo.js";

export default class Todo implements ITodo {
    path: string;
    line: number;
    content: string;
    priority?: Priority | undefined;
    dueDate?: Date | undefined;
    responsibles?: string[] | undefined;

    constructor(path: string, line: number, content: string) {
        this.path = path;
        this.line = line;
        this.content = content;
        
        this.determinePriority();
        this.determineDueDate();
        this.determineResponsibles();
    }

    toString() {
        return `${this.path} [${this.line}]: ${this.content}`;
    }

    private determinePriority(): void {
        const match = this.content.match(/@prio=(\w+)/);
        if (match) {
            switch (match[1].toLowerCase()) {
                case 'low':
                    this.priority = Priority.Low;
                case 'medium':
                    this.priority = Priority.Medium;
                case 'high':
                    this.priority = Priority.High;
            }
        }
    }

    private determineDueDate(): void {
        const match = this.content.match(/@due=(\d{4}-\d{2}-\d{2})/);
        if (match) {
            try {
                const dateParts = match[1].split('-');
                this.dueDate = new Date(
                    parseInt(dateParts[0]),
                    parseInt(dateParts[1]) - 1,
                    parseInt(dateParts[2]) - 1
                );
            } catch (err) {
                console.error(`Error while parsing date: ${err}`);
            }
        }
    }

    private determineResponsibles(): void {
        const match = this.content.match(/@resp=([\w+,]+)/);
        if (match) {
            this.responsibles = match[1].split(',').filter((el) => {
                return el !== '';
            });
        }
    }
}