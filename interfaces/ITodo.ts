import Priority from "../enums/Priority.js";

export default interface ITodo {
    path: string;
    line: number;
    content: string;
    priority?: Priority;
    dueDate?: Date;
    responsibles?: string[]
}