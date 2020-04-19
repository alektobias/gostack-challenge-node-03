import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import { getRepository, In, getCustomRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import uploadConfig from '../config/upload';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(csv_filename: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const parsers = csvParse({ delimiter: ',', from_line: 2 });

    const csvFilePath = path.join(uploadConfig.directory, csv_filename);
    const csvReadStream = fs.createReadStream(csvFilePath);
    const parseCSV = csvReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );
      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategory = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });
    const existentCategoryTitle = existentCategory.map(
      (category: Category) => category.title,
    );

    const nonExistentCategoryTitles = categories
      .filter(category => !existentCategoryTitle.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      nonExistentCategoryTitles.map(title => ({ title })),
    );
    await categoriesRepository.save(newCategories);

    const finalCategories = [...existentCategory, ...newCategories];

    const newTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );
    await transactionsRepository.save(newTransactions);
    await fs.promises.unlink(csvFilePath);

    return newTransactions;
  }
}

export default ImportTransactionsService;
